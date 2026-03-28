import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createTopicAction } from "@/actions/topic";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-200">Кабинет преподавателя</p>
          <h1 className="font-display mt-4 text-4xl font-semibold">Общие темы, файлы и индивидуальный прогресс учеников</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Все темы общие для всех учеников. Внутри каждой темы хранятся файлы и список номеров, а статусы по
            номерам записываются отдельно для каждого ученика.
          </p>
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
        title="Создать новую тему"
        description="Добавьте тему, прикрепите файлы и укажите список номеров домашнего задания."
      >
        <form action={createTopicAction} className="grid gap-4 lg:grid-cols-2" encType="multipart/form-data">
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Название темы</span>
            <input
              type="text"
              name="title"
              placeholder="Например, Логарифмы и их свойства"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Описание</span>
            <textarea
              name="description"
              rows={4}
              placeholder="Что нужно изучить в теории и на что обратить внимание в домашнем задании."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Файл теории</span>
            <input
              type="file"
              name="theoryFile"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Файл домашнего задания</span>
            <input
              type="file"
              name="homeworkFile"
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              required
            />
          </label>

          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-slate-700">Номера домашнего задания</span>
            <input
              type="text"
              name="numbers"
              placeholder="12, 14, 18, 22"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <div className="lg:col-span-2">
            <button
              type="submit"
              className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Создать тему
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Все темы"
        description="Темы общие для всех учеников. Здесь можно открыть тему, отредактировать файлы и посмотреть матрицу статусов."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.topics.map((topic) => (
            <article key={topic.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Учеников: {topic.totalStudents} · Номеров: {topic.totalNumbers}
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">{topic.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{topic.description}</p>
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
      </SectionCard>
    </div>
  );
}
