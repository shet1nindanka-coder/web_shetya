import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createStudentAction } from "@/actions/student";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
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
      : studentError === "invalid"
        ? "studentInvalid"
        : studentError === "exists"
          ? "studentExists"
          : studentError === "save"
            ? "studentSave"
            : null;
  const notice = noticeKey ? studentNotices[noticeKey] : null;

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900"
              : "rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <PageHeader
        eyebrow="Ученики"
        title="Аккаунты и прогресс"
        description="Создавайте доступы ученикам и открывайте их личные результаты из одного списка."
        metrics={[
          { label: "Ученики", value: data.students.length },
          { label: "Темы в системе", value: data.stats.totalTopics },
          { label: "Номера в системе", value: data.stats.totalNumbers }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">Работа с учениками</p>
            <p className="mt-2 font-display text-[1.65rem] font-semibold text-[var(--theme-text-strong)]">
              {data.students.length} аккаунтов
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">Новые логины создаются здесь же, без отдельной панели администратора.</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ученики" value={data.students.length} />
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Номера" value={data.stats.totalNumbers} />
        <StatCard label="Файлы" value={data.stats.totalFiles} />
      </div>

      <SectionCard title="Добавить ученика" description="Создайте логин и пароль для нового ученика.">
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <form action={createStudentAction} className="space-y-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="space-y-2">
              <h3 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.55rem]">Создать доступ ученику</h3>
              <p className="ui-hint text-sm leading-6 text-slate-600">Можно использовать e-mail как логин.</p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Имя ученика</span>
              <input
                type="text"
                name="name"
                placeholder="Например, Мария Смирнова"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Логин ученика</span>
              <input
                type="text"
                name="login"
                placeholder="maria@example.com"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Пароль</span>
              <input
                type="password"
                name="password"
                placeholder="Минимум 8 символов"
                minLength={8}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
            </label>

            <button
              type="submit"
              className="ui-pressable w-full rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
            >
              Добавить ученика
            </button>
          </form>

          <div className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="ui-kicker">Текущие ученики</p>
                <h3 className="font-display mt-2 text-[1.35rem] font-semibold text-slate-950 sm:text-[1.55rem]">
                  {data.students.length} аккаунтов ученика
                </h3>
              </div>
            </div>

            {data.students.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-600">
                Пока ни одного ученика не добавлено.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {data.students.map((student) => (
                  <article key={student.id} className="ui-surface rounded-[18px] border border-white bg-white px-4 py-4">
                    <p className="font-semibold text-slate-950">{student.name}</p>
                    <p className="mt-2 text-sm text-slate-500">Логин</p>
                    <p className="text-sm font-medium text-slate-700">{student.email}</p>
                    <div className="mt-4">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="ui-pressable inline-flex w-full justify-center rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700 sm:w-auto"
                      >
                        Смотреть прогресс
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
