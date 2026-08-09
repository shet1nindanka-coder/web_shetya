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

export async function createAccountAction(formData: FormData) {
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
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "invalid" }));
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
      redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "rateLimited" }));
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
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "save" }));
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
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "rateLimited" }));
  }

  // Ученик обязан принадлежать существующему учителю (SEC-003).
  let ownerTeacherId: string | null = null;

  if (role === UserRole.STUDENT) {
    const ownerTeacher = await prisma.user.findFirst({
      where: { id: teacherIdRaw, role: UserRole.TEACHER },
      select: { id: true }
    });

    if (!ownerTeacher) {
      redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "invalid" }));
    }

    ownerTeacherId = ownerTeacher!.id;
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
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "exists" }));
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
    redirectDeveloperWithAccountStatus(new URLSearchParams({ accountError: "save" }));
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
  redirectDeveloperWithAccountStatus(
    new URLSearchParams({ accountCreated: accountRole === UserRole.TEACHER ? "teacher" : "student" })
  );
}
