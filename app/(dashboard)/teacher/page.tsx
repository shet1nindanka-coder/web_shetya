import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createStudentAction } from "@/actions/student";
import { Badge } from "@/components/badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TopicCreateForm } from "@/components/topic-create-form";
import { requireUser } from "@/lib/auth";
import { getBlobAccessMode } from "@/lib/storage";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

type TeacherPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const teacherNotices = {
  created: {
    tone: "success",
    message: "Новая тема успешно создана."
  },
  invalid: {
    tone: "error",
    message: "Проверьте форму: название, описание, файлы и список номеров обязательны."
  },
  upload: {
    tone: "error",
    message: "Не удалось загрузить файлы. Если сайт работает на Vercel, проверьте BLOB_READ_WRITE_TOKEN."
  },
  save: {
    tone: "error",
    message: "Не удалось сохранить тему в базе данных. Проверьте подключение к PostgreSQL и логи сервера."
  },
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

export default async function TeacherPage({ searchParams }: TeacherPageProps) {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();
  const uploadMode = process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local";
  const blobAccess = getBlobAccessMode();
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = typeof resolvedSearchParams.created === "string" ? resolvedSearchParams.created : undefined;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;
  const studentCreated =
    typeof resolvedSearchParams.studentCreated === "string" ? resolvedSearchParams.studentCreated : undefined;
  const studentError =
    typeof resolvedSearchParams.studentError === "string" ? resolvedSearchParams.studentError : undefined;
  const noticeKey =
    created === "1"
      ? "created"
      : error && error in teacherNotices
        ? (error as keyof typeof teacherNotices)
        : studentCreated === "1"
          ? "studentCreated"
          : studentError === "invalid"
            ? "studentInvalid"
            : studentError === "exists"
              ? "studentExists"
              : studentError === "save"
                ? "studentSave"
                : null;
  const notice =
    noticeKey ? teacherNotices[noticeKey] : null;

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
        <div className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Кабинет преподавателя</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">Общие темы, файлы и индивидуальный прогресс учеников</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Все темы общие для всех учеников. Внутри каждой темы хранятся файлы и список номеров, а статусы по
            номерам записываются отдельно для каждого ученика.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-slate-100">Общие темы для всех</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Индивидуальный прогресс</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Файлы и номера</Badge>
          </div>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Сейчас на платформе</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">
            {data.stats.totalMarked} отмеченных статусов по всем темам
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Откройте тему, чтобы редактировать файлы, номера и посмотреть статусы каждого ученика по каждому номеру.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Общий список тем для всех учеников." />
        <StatCard label="Ученики" value={data.stats.totalStudents} hint="Пользователи с ролью STUDENT." />
        <StatCard label="Файлы" value={data.stats.totalFiles} hint="Загруженные файлы теории и домашки." />
        <StatCard label="Номера" value={data.stats.totalNumbers} hint="Все номера по всем темам." />
      </div>

      <SectionCard
        title="Ученики"
        description="Добавьте нового ученика вручную: задайте имя, логин и пароль. После создания ученик сразу сможет войти в систему."
      >
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <form action={createStudentAction} className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Новый ученик</p>
              <h3 className="font-display text-2xl font-semibold text-slate-950">Создать доступ ученику</h3>
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
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Добавить ученика
            </button>
          </form>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Текущие ученики</p>
                <h3 className="font-display mt-2 text-2xl font-semibold text-slate-950">
                  {data.students.length} аккаунтов ученика
                </h3>
              </div>
              <Badge className="border-slate-200 bg-white text-slate-700">Роль STUDENT</Badge>
            </div>

            {data.students.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-600">
                Пока ни одного ученика не добавлено.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {data.students.map((student) => (
                  <article key={student.id} className="rounded-2xl border border-white bg-white px-4 py-4">
                    <p className="font-semibold text-slate-950">{student.name}</p>
                    <p className="mt-2 text-sm text-slate-500">Логин</p>
                    <p className="text-sm font-medium text-slate-700">{student.email}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Создать новую тему"
        description="Добавьте тему, прикрепите файлы и укажите список номеров заданий."
      >
        <TopicCreateForm uploadMode={uploadMode} blobAccess={blobAccess} />
      </SectionCard>

      <SectionCard
        title="Все темы"
        description="Темы общие для всех учеников. Здесь можно открыть тему, отредактировать файлы и посмотреть матрицу статусов."
      >
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Пока нет ни одной темы</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Начните с первой темы: добавьте описание, прикрепите файлы и укажите номера заданий.
            </p>
          </div>
        ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.topics.map((topic) => (
            <article key={topic.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Учеников: {topic.totalStudents} · Номеров: {topic.totalNumbers}
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">{topic.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{topic.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700">
                      Активны {topic.studentsWithActivity}/{topic.totalStudents}
                    </Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700">
                      Слотов {topic.totalSlots}
                    </Badge>
                  </div>
                </div>
                <div className="rounded-[24px] border border-white bg-white px-4 py-3 text-sm text-slate-600">
                  Файлы:{" "}
                  <span className="font-semibold text-slate-950">
                    {(topic.theoryFile ? 1 : 0) + (topic.homeworkFile ? 1 : 0)} / 2
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Зеленые</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{topic.greenCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Желтые</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{topic.yellowCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Красные</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-700">{topic.redCount}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Заполненность статусов</span>
                  <span className="font-semibold text-slate-950">{topic.progressPercent}%</span>
                </div>
                <ProgressBar value={topic.progressPercent} />
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/teacher/topics/${topic.id}`}
                  className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Открыть и редактировать
                </Link>
              </div>
            </article>
          ))}
        </div>
        )}
      </SectionCard>
    </div>
  );
}
