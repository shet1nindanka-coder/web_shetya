import Link from "next/link";
import { UserRole } from "@prisma/client";
import { deleteStudentAction } from "@/actions/student";
import { StudentPasswordResetButton } from "@/components/student-password-reset-button";
import { DeleteButton } from "@/components/delete-button";
import { StudentCreateForm } from "@/components/student-create-form";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

type TeacherStudentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const studentNotices = {
  studentCreated: {
    tone: "success",
    message: "Новый ученик успешно добавлен. Ему уже можно входить в систему."
  },
  studentInvalid: {
    tone: "error",
    message: "Укажите имя, логин и пароль: минимум 8 символов, обязательно буквы и цифры."
  },
  studentExists: {
    tone: "error",
    message: "Ученик с таким логином уже существует."
  },
  studentSave: {
    tone: "error",
    message: "Не удалось создать ученика. Проверьте подключение к PostgreSQL и повторите попытку."
  },
  studentRateLimited: {
    tone: "error",
    message: "Слишком много попыток создать учеников за короткое время. Подождите несколько минут."
  },
  studentDeleted: {
    tone: "success",
    message: "Ученик удалён. Список и статистика уже обновлены."
  },
  studentDelete: {
    tone: "error",
    message: "Не удалось удалить ученика. Повторите попытку ещё раз."
  },
  studentDeleteMissing: {
    tone: "error",
    message: "Такого ученика уже нет в системе."
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
  }
} as const;

export default async function TeacherStudentsPage({ searchParams }: TeacherStudentsPageProps) {
  const user = await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview(user);
  const resolvedSearchParams = (await searchParams) ?? {};
  const studentCreated =
    typeof resolvedSearchParams.studentCreated === "string" ? resolvedSearchParams.studentCreated : undefined;
  const studentError =
    typeof resolvedSearchParams.studentError === "string" ? resolvedSearchParams.studentError : undefined;
  const passwordReset =
    typeof resolvedSearchParams.passwordReset === "string" ? resolvedSearchParams.passwordReset : undefined;
  const passwordResetError =
    typeof resolvedSearchParams.passwordResetError === "string" ? resolvedSearchParams.passwordResetError : undefined;
  const noticeKey =
    passwordReset === "1"
      ? "passwordReset"
      : passwordResetError === "invalid"
        ? "passwordInvalid"
        : passwordResetError === "missing"
          ? "passwordMissing"
          : passwordResetError === "save"
            ? "passwordSave"
            : passwordResetError === "rateLimited"
              ? "passwordRateLimited"
    : studentCreated === "1"
      ? "studentCreated"
      : typeof resolvedSearchParams.studentDeleted === "string" && resolvedSearchParams.studentDeleted === "1"
        ? "studentDeleted"
      : studentError === "invalid"
        ? "studentInvalid"
        : studentError === "exists"
          ? "studentExists"
          : studentError === "save"
            ? "studentSave"
            : studentError === "rateLimited"
              ? "studentRateLimited"
            : studentError === "delete"
              ? "studentDelete"
              : studentError === "deleteMissing"
                ? "studentDeleteMissing"
            : null;
  const notice = noticeKey ? studentNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader kicker="Ученики" title="Аккаунты и прогресс" aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />} />

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
        <h2 className="shbz-section-title">Добавить ученика</h2>
        <div className="shbz-card shbz-section-pad">
          <StudentCreateForm />
        </div>
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Текущие ученики</h2>

        {data.students.length === 0 ? (
          <div className="shbz-card px-6 py-10 text-center">
            <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Пока ни одного ученика не добавлено.
            </p>
          </div>
        ) : (
          <div className="shbz-card px-7 py-2">
            <div
              className="hidden items-center gap-5 border-b py-[18px] md:grid md:grid-cols-[1.2fr_1.6fr_auto]"
              style={{ borderColor: "var(--shbz-soft-border)" }}
            >
              <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                Ученик
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                Логин
              </div>
              <div
                className="text-right text-[11px] font-bold uppercase tracking-[1.2px]"
                style={{ color: "var(--shbz-kicker)" }}
              >
                Действия
              </div>
            </div>

            {data.students.map((student, index) => (
              <div
                key={student.id}
                className="flex flex-col gap-3 py-5 md:grid md:grid-cols-[1.2fr_1.6fr_auto] md:items-center md:gap-5"
                style={
                  index < data.students.length - 1
                    ? { borderBottom: "1px solid var(--shbz-row-border)" }
                    : undefined
                }
              >
                <div className="min-w-0 truncate text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {student.name}
                </div>
                <div className="min-w-0 truncate text-[15px]" style={{ color: "var(--shbz-text-muted)" }}>
                  {student.email}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
                  <Link
                    href={`/teacher/students/${student.id}`}
                    className="shbz-btn-primary px-5 py-[11px] text-sm"
                    style={{ boxShadow: "0 5px 14px var(--shbz-accent-shadow)" }}
                  >
                    Смотреть прогресс
                  </Link>
                  <StudentPasswordResetButton studentId={student.id} studentName={student.name} />
                  <DeleteButton
                    label="Удалить"
                    title="Удалить ученика?"
                    description={
                      <>
                        Аккаунт <span className="font-semibold">«{student.name}»</span> будет удалён вместе со всеми его
                        ДЗ, фото решений, историей проверок, статусами по номерам и дедлайнами. Это действие нельзя отменить.
                      </>
                    }
                    action={deleteStudentAction}
                    fields={{ studentId: student.id }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
