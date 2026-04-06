import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createStudentAction } from "@/actions/student";
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

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Учётные записи и индивидуальные успехи учеников</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Создавайте новые аккаунты учеников и переходите в их персональные карточки, чтобы смотреть прогресс по
            всем темам и видеть цвета по каждому номеру.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">Работа с учениками</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">Здесь удобно создавать аккаунты и переходить в карточки прогресса</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Общую числовую картину по платформе и темам можно смотреть отдельно во вкладке статистики.
          </p>
        </div>
      </section>

      <SectionCard
        title="Добавить ученика"
        description="Задайте имя, логин и пароль. После создания ученик сразу сможет войти в систему."
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <form action={createStudentAction} className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:rounded-[28px] sm:p-5">
            <div className="space-y-2">
              <h3 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">Создать доступ ученику</h3>
              <p className="text-sm leading-6 text-slate-600">
                Логин используется для входа. Для удобства можно использовать e-mail в качестве логина.
              </p>
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

          <div className="ui-fade-slide ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:rounded-[28px] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Текущие ученики</p>
                <h3 className="font-display mt-2 text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">
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
                  <article key={student.id} className="ui-surface rounded-2xl border border-white bg-white px-4 py-4">
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
