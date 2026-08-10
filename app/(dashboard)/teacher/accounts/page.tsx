import { UserRole } from "@prisma/client";
import { AccountCreateForm } from "@/components/account-create-form";
import { AccountStudentsManager } from "@/components/account-students-manager";
import { AccountTeachersManager } from "@/components/account-teachers-manager";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/*
 * Вкладка разработчика «аккаунты»: создание учеников и учителей.
 * Живёт на /developer/accounts (rewrite с /teacher/accounts), доступна
 * только роли DEVELOPER — учитель добавляет учеников на своей вкладке.
 */

export const dynamic = "force-dynamic";

type AccountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const accountNotices = {
  studentCreated: {
    tone: "success",
    message: "Аккаунт ученика создан. Ему уже можно входить в систему."
  },
  teacherCreated: {
    tone: "success",
    message: "Аккаунт учителя создан. Ему уже можно входить в систему."
  },
  invalid: {
    tone: "error",
    message: "Укажите роль, учителя (для ученика), имя, логин и пароль: минимум 8 символов, обязательно буквы и цифры."
  },
  exists: {
    tone: "error",
    message: "Аккаунт с таким логином уже существует."
  },
  save: {
    tone: "error",
    message: "Не удалось создать аккаунт. Проверьте подключение к PostgreSQL и повторите попытку."
  },
  rateLimited: {
    tone: "error",
    message: "Слишком много попыток создать аккаунты за короткое время. Подождите несколько минут."
  },
  ownerChanged: {
    tone: "success",
    message: "Учитель ученика обновлён. Ученик уже виден новому учителю."
  },
  ownerInvalid: {
    tone: "error",
    message: "Не удалось сменить учителя: ученик или учитель не найдены. Обновите страницу."
  },
  ownerSave: {
    tone: "error",
    message: "Не удалось сменить учителя. Повторите попытку ещё раз."
  },
  passwordReset: {
    tone: "success",
    message: "Пароль ученика обновлён, все его сессии завершены. Передайте ученику новый пароль."
  },
  passwordInvalid: {
    tone: "error",
    message: "Новый пароль не подходит: минимум 8 символов, обязательно буквы и цифры."
  },
  passwordMissing: {
    tone: "error",
    message: "Такого ученика уже нет в системе."
  },
  passwordSave: {
    tone: "error",
    message: "Не удалось сменить пароль. Повторите попытку ещё раз."
  },
  passwordRateLimited: {
    tone: "error",
    message: "Слишком много смен пароля за короткое время. Подождите несколько минут."
  },
  teacherDeleted: {
    tone: "success",
    message: "Учитель удалён. Его ученики переведены на выбранного учителя."
  },
  teacherMissing: {
    tone: "error",
    message: "Такого учителя уже нет в системе. Обновите страницу."
  },
  teacherTransfer: {
    tone: "error",
    message: "Учитель не удалён: сначала выберите, кому передать его учеников."
  },
  teacherDelete: {
    tone: "error",
    message: "Не удалось удалить учителя. Повторите попытку ещё раз."
  },
  teacherPasswordReset: {
    tone: "success",
    message: "Пароль учителя обновлён, все его сессии завершены. Передайте учителю новый пароль."
  },
  teacherPasswordInvalid: {
    tone: "error",
    message: "Новый пароль не подходит: минимум 8 символов, обязательно буквы и цифры."
  },
  teacherPasswordMissing: {
    tone: "error",
    message: "Такого учителя уже нет в системе."
  },
  teacherPasswordSave: {
    tone: "error",
    message: "Не удалось сменить пароль учителя. Повторите попытку ещё раз."
  },
  teacherPasswordRateLimited: {
    tone: "error",
    message: "Слишком много смен пароля за короткое время. Подождите несколько минут."
  }
} as const;

export default async function DeveloperAccountsPage({ searchParams }: AccountsPageProps) {
  await requireUser(UserRole.DEVELOPER);
  const params = (await searchParams) ?? {};
  // Мелкие форм-данные: список учителей для привязки ученика.
  const [teachers, students] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.TEACHER },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        // Счётчики нужны окну удаления: сколько учеников переводить и что
        // исчезнет вместе с аккаунтом (занятия и тесты каскадные).
        _count: { select: { students: true, lessonsTaught: true, testsCreated: true } }
      }
    }),
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, teacherId: true }
    })
  ]);
  // Формам нужен только выбор учителя — без счётчиков.
  const teacherOptions = teachers.map((teacher) => ({ id: teacher.id, name: teacher.name, email: teacher.email }));
  const created = typeof params.accountCreated === "string" ? params.accountCreated : undefined;
  const error = typeof params.accountError === "string" ? params.accountError : undefined;
  const ownerChanged = typeof params.ownerChanged === "string" ? params.ownerChanged : undefined;
  const passwordReset = typeof params.passwordReset === "string" ? params.passwordReset : undefined;
  const passwordResetError =
    typeof params.passwordResetError === "string" ? params.passwordResetError : undefined;
  const teacherDeleted = typeof params.teacherDeleted === "string" ? params.teacherDeleted : undefined;
  const teacherPasswordReset =
    typeof params.teacherPasswordReset === "string" ? params.teacherPasswordReset : undefined;
  const teacherPasswordError =
    typeof params.teacherPasswordError === "string" ? params.teacherPasswordError : undefined;
  const teacherPasswordNoticeKey =
    teacherPasswordError === "invalid"
      ? "teacherPasswordInvalid"
      : teacherPasswordError === "missing"
        ? "teacherPasswordMissing"
        : teacherPasswordError === "save"
          ? "teacherPasswordSave"
          : teacherPasswordError === "rateLimited"
            ? "teacherPasswordRateLimited"
            : null;

  // Статусы приходят из разных экшенов (создание, владелец, пароли, удаление) —
  // берём первый сработавший, порядок сверху вниз от самого свежего действия.
  const noticeKey =
    (teacherDeleted === "1" && "teacherDeleted") ||
    (teacherPasswordReset === "1" && "teacherPasswordReset") ||
    teacherPasswordNoticeKey ||
    (created === "teacher" && "teacherCreated") ||
    (created === "student" && "studentCreated") ||
    (ownerChanged === "1" && "ownerChanged") ||
    (passwordReset === "1" && "passwordReset") ||
    (passwordResetError === "invalid" && "passwordInvalid") ||
    (passwordResetError === "missing" && "passwordMissing") ||
    (passwordResetError === "save" && "passwordSave") ||
    (passwordResetError === "rateLimited" && "passwordRateLimited") ||
    (error && error in accountNotices
      ? (error as Exclude<keyof typeof accountNotices, "studentCreated" | "teacherCreated">)
      : null);

  const notice = noticeKey ? accountNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader
        kicker="Аккаунты"
        title="Создание аккаунтов"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "shbz-notice-success mb-8 px-5 py-4 text-sm font-medium"
              : "shbz-notice-error mb-8 px-5 py-4 text-sm font-medium"
          }
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <section>
        <h2 className="shbz-section-title">Новый аккаунт</h2>
        <div className="shbz-card shbz-section-pad">
          <AccountCreateForm teachers={teacherOptions} />
        </div>
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Учителя</h2>
        <AccountTeachersManager
          teachers={teachers.map((teacher) => ({
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            studentCount: teacher._count.students,
            lessonCount: teacher._count.lessonsTaught,
            testCount: teacher._count.testsCreated
          }))}
        />
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Ученики: учитель и пароль</h2>
        <AccountStudentsManager students={students} teachers={teacherOptions} />
      </section>
    </div>
  );
}
