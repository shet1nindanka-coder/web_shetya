import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createStudentAction } from "@/actions/student";
import { DeleteStudentDialog } from "@/components/delete-student-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
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
    message: "Укажите имя, логин и пароль не короче 8 символов."
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
  }
} as const;

export default async function TeacherStudentsPage({ searchParams }: TeacherStudentsPageProps) {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();
  const resolvedSearchParams = (await searchParams) ?? {};
  const studentCreated =
    typeof resolvedSearchParams.studentCreated === "string" ? resolvedSearchParams.studentCreated : undefined;
  const studentError =
    typeof resolvedSearchParams.studentError === "string" ? resolvedSearchParams.studentError : undefined;
  const noticeKey =
    studentCreated === "1"
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
    <div className="space-y-5 sm:space-y-6">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "ui-notice-success rounded-[14px] px-4 py-3 text-sm font-medium sm:rounded-[16px]"
              : "ui-notice-error rounded-[14px] px-4 py-3 text-sm font-medium sm:rounded-[16px]"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <PageHeader
        eyebrow="Ученики"
        title="Аккаунты и прогресс"
        description="Создавайте доступы ученикам и открывайте их личные результаты из одного списка."
      />

      <SectionCard title="Добавить ученика" description="Создайте логин и пароль для нового ученика.">
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <form
            action={createStudentAction}
            className="ui-panel-soft self-start space-y-3 rounded-[14px] p-3.5 sm:space-y-4 sm:rounded-[16px] sm:p-4"
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Создать доступ ученику</h3>
              <p className="ui-hint text-sm leading-relaxed text-[var(--theme-text-muted)]">Можно использовать e-mail как логин.</p>
            </div>

            <label className="block space-y-1.5">
              <span className="ui-form-label">Имя ученика</span>
              <input
                type="text"
                name="name"
                placeholder="Например, Мария Смирнова"
                className="ui-input w-full rounded-[12px] px-3.5 py-2.5 sm:rounded-[14px]"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="ui-form-label">Логин ученика</span>
              <input
                type="text"
                name="login"
                placeholder="maria@example.com"
                className="ui-input w-full rounded-[12px] px-3.5 py-2.5 sm:rounded-[14px]"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="ui-form-label">Пароль</span>
              <input
                type="password"
                name="password"
                placeholder="Минимум 8 символов"
                minLength={8}
                className="ui-input w-full rounded-[12px] px-3.5 py-2.5 sm:rounded-[14px]"
                required
              />
            </label>

            <button
              type="submit"
              className="ui-pressable ui-button-primary w-full rounded-[10px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
            >
              Добавить ученика
            </button>
          </form>

          <div className="ui-fade-slide ui-surface self-start rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="ui-kicker">Текущие ученики</p>
                <h3 className="font-display mt-1.5 text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">
                  {data.students.length} аккаунтов ученика
                </h3>
              </div>
            </div>

            {data.students.length === 0 ? (
              <div className="ui-panel-soft mt-4 rounded-[14px] border-dashed px-4 py-6 text-center text-sm text-[var(--theme-text-muted)]">
                Пока ни одного ученика не добавлено.
              </div>
            ) : (
              <div className="mt-4 overflow-hidden rounded-[14px] border border-[var(--theme-border-soft)] bg-[color-mix(in_srgb,var(--theme-surface-soft)_90%,white_10%)] sm:rounded-[16px]">
                <div className="max-h-[36rem] overflow-y-auto">
                  <div className="divide-y divide-[var(--theme-border-soft)]">
                    {data.students.map((student) => (
                      <article key={student.id} className="px-3.5 py-3 sm:px-4 sm:py-3.5">
                        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--theme-text-strong)]">{student.name}</p>
                            <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Ученик</p>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs text-[var(--theme-text-muted)]">Логин</p>
                            <p className="truncate text-sm font-medium text-[var(--theme-text-default)]">{student.email}</p>
                          </div>

                          <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link
                              href={`/teacher/students/${student.id}`}
                              className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-1.5 text-sm font-semibold transition sm:w-auto"
                            >
                              Смотреть прогресс
                            </Link>
                            <DeleteStudentDialog
                              studentId={student.id}
                              studentName={student.name}
                              triggerClassName="w-full sm:w-auto"
                            />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
