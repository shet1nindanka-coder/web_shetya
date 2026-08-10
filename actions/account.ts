"use server";

import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getHeadersLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { hashPassword } from "@/lib/password";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";
import { consumePersistentRateLimit } from "@/lib/persistent-rate-limit";
import { revalidateTeacherStudentsData, revalidateTeacherTopicsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, getClientIpFromHeaders, RateLimitExceededError } from "@/lib/rate-limit";
import {
  MAX_LOGIN_LENGTH,
  MAX_USER_NAME_LENGTH,
  normalizeLoginInput,
  normalizeSingleLineText
} from "@/lib/utils";

/*
 * Создание аккаунтов учеников и учителей разработчиком. Повторяет
 * createStudentAction (actions/student.ts) — та же валидация, лимиты и
 * сообщения, — но доступно только роли DEVELOPER и умеет выбирать роль.
 */

function redirectDeveloperWithAccountStatus(params: URLSearchParams): never {
  const query = params.toString();
  redirect(query ? `/developer/accounts?${query}` : "/developer/accounts");
}

export type CreateAccountResult = { ok: boolean; message: string };

/**
 * Возвращает результат клиенту (без redirect): форма показывает всплывающее
 * окно с логином и паролем — после него пароль больше нигде не показывается.
 */
export async function createAccountAction(formData: FormData): Promise<CreateAccountResult> {
  const developer = await requireUser(UserRole.DEVELOPER);

  const roleRaw = String(formData.get("role") ?? "");
  const role = roleRaw === "TEACHER" ? UserRole.TEACHER : roleRaw === "STUDENT" ? UserRole.STUDENT : null;
  const teacherIdRaw = String(formData.get("teacherId") ?? "").trim();
  const name = normalizeSingleLineText(String(formData.get("name") ?? ""));
  const login = normalizeLoginInput(String(formData.get("login") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (
    !role ||
    (role === UserRole.STUDENT && !teacherIdRaw) ||
    !name ||
    name.length > MAX_USER_NAME_LENGTH ||
    !login ||
    login.length > MAX_LOGIN_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH ||
    validatePasswordStrength(password) !== null
  ) {
    return {
      ok: false,
      message: "Укажите роль, учителя (для ученика), имя, логин и пароль: минимум 8 символов, буквы и цифры."
    };
  }

  const requestHeaders = await headers();
  const clientIp = getClientIpFromHeaders(requestHeaders);

  try {
    assertRateLimit(
      {
        scope: "create-account",
        identifier: `${developer.id}:${clientIp}`,
        limit: 20,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много попыток создать аккаунты."
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      logWarnEvent(
        "account.create.rate_limited",
        getHeadersLogContext(requestHeaders, {
          developerId: developer.id
        }),
        error,
        "Account creation request was rate limited."
      );
      return { ok: false, message: "Слишком много попыток создать аккаунты. Подождите несколько минут." };
    }

    throw error;
  }

  let persistentRateLimit: Awaited<ReturnType<typeof consumePersistentRateLimit>>;

  try {
    persistentRateLimit = await consumePersistentRateLimit({
      scope: "create-account",
      identifier: developer.id,
      limit: 20,
      windowMs: 10 * 60_000
    });
  } catch (error) {
    logErrorEvent(
      "account.create.rate_limit_failed",
      getHeadersLogContext(requestHeaders, {
        developerId: developer.id
      }),
      error,
      "Persistent account creation rate limit failed."
    );
    return { ok: false, message: "Не удалось создать аккаунт. Проверьте подключение к PostgreSQL и повторите попытку." };
  }

  if (!persistentRateLimit.allowed) {
    logWarnEvent(
      "account.create.rate_limited",
      getHeadersLogContext(requestHeaders, {
        developerId: developer.id,
        retryAfterMs: persistentRateLimit.retryAfterMs
      }),
      undefined,
      "Account creation was rate limited by the persistent developer limit."
    );
    return { ok: false, message: "Слишком много попыток создать аккаунты. Подождите несколько минут." };
  }

  // Ученик обязан принадлежать существующему учителю (SEC-003).
  let ownerTeacherId: string | null = null;

  if (role === UserRole.STUDENT) {
    const ownerTeacher = await prisma.user.findFirst({
      where: { id: teacherIdRaw, role: UserRole.TEACHER },
      select: { id: true }
    });

    if (!ownerTeacher) {
      return { ok: false, message: "Выбранный учитель не найден — обновите страницу и попробуйте снова." };
    }

    ownerTeacherId = ownerTeacher.id;
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: login
    },
    select: {
      id: true
    }
  });

  if (existingUser) {
    logWarnEvent(
      "account.create.duplicate_login",
      getHeadersLogContext(requestHeaders, {
        developerId: developer.id,
        accountLogin: login
      }),
      undefined,
      "Account creation was skipped because the login already exists."
    );
    return { ok: false, message: "Аккаунт с таким логином уже существует." };
  }

  const accountRole = role!;

  try {
    const passwordHash = await hashPassword(password);

    await prisma.user.create({
      data: {
        name,
        email: login,
        passwordHash,
        role: accountRole,
        teacherId: ownerTeacherId
      }
    });
  } catch (error) {
    logErrorEvent(
      "account.create.failed",
      {
        developerId: developer.id,
        clientIp,
        accountLogin: login,
        accountName: name,
        accountRole
      },
      error,
      "Failed to create account."
    );
    return { ok: false, message: "Не удалось создать аккаунт. Проверьте подключение к PostgreSQL и повторите попытку." };
  }

  logInfoEvent(
    "account.create.succeeded",
    {
      developerId: developer.id,
      clientIp,
      accountLogin: login,
      accountName: name,
      accountRole
    },
    "Account was created by the developer."
  );
  revalidateTeacherStudentsData();
  revalidateTeacherTopicsData();
  publishDashboardRealtimeEvent({ kind: "students-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/statistics");

  return {
    ok: true,
    message: accountRole === UserRole.TEACHER ? "Аккаунт учителя создан." : "Аккаунт ученика создан."
  };
}

/*
 * Смена учителя-владельца ученика (Б-4 аудита 10.08.2026). До этого teacherId
 * писался только при создании: осиротевшего или неверно привязанного ученика
 * (бэкфилл волны 5, восстановление из бэкапа) лечили ручным SQL на VPS.
 */
export async function changeStudentOwnerAction(formData: FormData) {
  const developer = await requireUser(UserRole.DEVELOPER);

  const studentId = String(formData.get("studentId") ?? "").trim();
  const teacherId = String(formData.get("teacherId") ?? "").trim();

  if (!studentId || !teacherId) {
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "ownerInvalid" }));
  }

  const [teacher, student] = await Promise.all([
    prisma.user.findFirst({
      where: { id: teacherId, role: UserRole.TEACHER },
      select: { id: true }
    }),
    prisma.user.findFirst({
      where: { id: studentId, role: UserRole.STUDENT },
      select: { id: true, teacherId: true }
    })
  ]);

  if (!teacher || !student) {
    logWarnEvent(
      "student.owner_change.missing",
      { developerId: developer.id, studentId, newTeacherId: teacherId },
      undefined,
      "Student owner change was skipped: student or teacher was not found."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "ownerInvalid" }));
  }

  if (student!.teacherId === teacher!.id) {
    // Идемпотентно: владелец уже тот, просто подтверждаем.
    redirectDeveloperWithAccountStatus(new URLSearchParams({ ownerChanged: "1" }));
  }

  try {
    await prisma.user.update({
      where: { id: student!.id },
      data: { teacherId: teacher!.id }
    });
  } catch (error) {
    logErrorEvent(
      "student.owner_change.failed",
      { developerId: developer.id, studentId, newTeacherId: teacherId },
      error,
      "Failed to change student owner."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "ownerSave" }));
  }

  logInfoEvent(
    "student.owner_change.succeeded",
    { developerId: developer.id, studentId, newTeacherId: teacherId },
    "Student owner was changed by the developer."
  );
  revalidateTeacherStudentsData();
  revalidateTeacherTopicsData();
  publishDashboardRealtimeEvent({ kind: "students-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/statistics");
  revalidatePath("/developer/accounts");
  redirectDeveloperWithAccountStatus(new URLSearchParams({ ownerChanged: "1" }));
}

/*
 * Удаление учителя разработчиком (10.08.2026). Учеников нельзя оставлять без
 * владельца: teacherId объявлен onDelete: SetNull, и осиротевший ученик
 * пропадает из списков всех учителей — поэтому при наличии учеников
 * обязателен новый владелец, перевод и удаление идут одной транзакцией.
 */
export async function deleteTeacherAction(formData: FormData) {
  const developer = await requireUser(UserRole.DEVELOPER);

  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const transferToTeacherId = String(formData.get("transferToTeacherId") ?? "").trim();

  if (!teacherId) {
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "teacherMissing" }));
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: UserRole.TEACHER },
    select: {
      id: true,
      name: true,
      _count: { select: { students: true } }
    }
  });

  if (!teacher) {
    logWarnEvent(
      "teacher.delete.missing",
      { developerId: developer.id, teacherId },
      undefined,
      "Teacher deletion was skipped because the teacher was not found."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "teacherMissing" }));
  }

  const studentCount = teacher!._count.students;
  let newOwnerId: string | null = null;

  if (studentCount > 0) {
    const newOwner =
      transferToTeacherId && transferToTeacherId !== teacherId
        ? await prisma.user.findFirst({
            where: { id: transferToTeacherId, role: UserRole.TEACHER },
            select: { id: true }
          })
        : null;

    if (!newOwner) {
      redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "teacherTransfer" }));
    }

    newOwnerId = newOwner!.id;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      if (newOwnerId) {
        await transaction.user.updateMany({
          where: { teacherId, role: UserRole.STUDENT },
          data: { teacherId: newOwnerId }
        });
      }

      // Файлы удаляемого учителя переходят разработчику: StoredFile.uploadedById
      // защищён Restrict, а удалять сами файлы нельзя — на них держится история
      // проверок ДЗ его бывших учеников (HomeworkCheckPhoto тоже Restrict).
      await transaction.storedFile.updateMany({
        where: { uploadedById: teacherId },
        data: { uploadedById: developer.id }
      });

      await transaction.user.delete({ where: { id: teacherId } });
    });
  } catch (error) {
    logErrorEvent(
      "teacher.delete.failed",
      { developerId: developer.id, teacherId, studentCount, newOwnerId },
      error,
      "Failed to delete teacher account."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "teacherDelete" }));
  }

  logInfoEvent(
    "teacher.delete.succeeded",
    { developerId: developer.id, teacherId, studentCount, newOwnerId },
    "Teacher account was deleted by the developer."
  );
  revalidateTeacherStudentsData();
  revalidateTeacherTopicsData();
  publishDashboardRealtimeEvent({ kind: "students-changed" });
  revalidatePath("/dashboard");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/statistics");
  revalidatePath("/developer/accounts");
  redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherDeleted: "1" }));
}

/*
 * Сброс пароля учителя разработчиком — пара к resetStudentPasswordAction.
 * Все сессии учителя закрываются, ученики и их работа не затрагиваются.
 */
export async function resetTeacherPasswordAction(formData: FormData) {
  const developer = await requireUser(UserRole.DEVELOPER);

  const teacherId = String(formData.get("teacherId") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!teacherId) {
    redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordError: "missing" }));
  }

  if (password.length > MAX_PASSWORD_LENGTH || validatePasswordStrength(password) !== null) {
    redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordError: "invalid" }));
  }

  const requestHeaders = await headers();
  const clientIp = getClientIpFromHeaders(requestHeaders);

  try {
    assertRateLimit(
      {
        scope: "reset-teacher-password",
        identifier: `${developer.id}:${clientIp}`,
        limit: 20,
        windowMs: 10 * 60 * 1000
      },
      "Слишком много смен пароля."
    );
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      logWarnEvent(
        "teacher.password_reset.rate_limited",
        getHeadersLogContext(requestHeaders, { developerId: developer.id }),
        error,
        "Teacher password reset was rate limited."
      );
      redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordError: "rateLimited" }));
    }

    throw error;
  }

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: UserRole.TEACHER },
    select: { id: true }
  });

  if (!teacher) {
    logWarnEvent(
      "teacher.password_reset.missing",
      { developerId: developer.id, teacherId },
      undefined,
      "Teacher password reset was skipped because the teacher was not found."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordError: "missing" }));
  }

  try {
    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({ where: { id: teacherId }, data: { passwordHash } }),
      // Старые сессии закрываются: если пароль утёк, доступ по нему обрывается сразу.
      prisma.session.deleteMany({ where: { userId: teacherId } })
    ]);
  } catch (error) {
    logErrorEvent(
      "teacher.password_reset.failed",
      { developerId: developer.id, teacherId },
      error,
      "Failed to reset teacher password."
    );
    redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordError: "save" }));
  }

  logInfoEvent(
    "teacher.password_reset.succeeded",
    { developerId: developer.id, teacherId },
    "Teacher password was reset by the developer."
  );
  revalidatePath("/developer/accounts");
  redirectDeveloperWithAccountStatus(new URLSearchParams({ teacherPasswordReset: "1" }));
}
