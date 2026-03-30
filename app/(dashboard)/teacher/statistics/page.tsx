import { UserRole } from "@prisma/client";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherStatisticsPage() {
  await requireUser(UserRole.TEACHER);

  const data = await getTeacherTopicsOverview();
  const totalStatusSlots = data.stats.totalStudents * data.stats.totalNumbers;
  const activeTopics = data.topics.filter((topic) => topic.studentsWithActivity > 0);
  const activeTopicsPercent = data.stats.totalTopics
    ? Math.round((activeTopics.length / data.stats.totalTopics) * 100)
    : 0;
  const markedPercent = totalStatusSlots ? Math.round((data.stats.totalMarked / totalStatusSlots) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Статистика платформы</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Здесь собрана общая числовая картина по темам, ученикам, файлам и прогрессу. Рабочие вкладки при этом
            остаются чище и не перегружены цифрами.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">Короткий срез</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">{markedPercent}% статусных слотов уже заполнены</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Активность есть у {activeTopics.length} из {data.stats.totalTopics} тем. Ниже можно посмотреть, какие темы
            двигаются лучше всего и где прогресс пока слабее.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все общие темы платформы." />
        <StatCard label="Ученики" value={data.stats.totalStudents} hint="Все аккаунты с ролью ученика." />
        <StatCard label="Файлы" value={data.stats.totalFiles} hint="Все файлы теории, заданий и ответов." />
        <StatCard label="Номера" value={data.stats.totalNumbers} hint="Все номера по общим темам." />
        <StatCard label="Статусы" value={data.stats.totalMarked} hint="Все отмеченные ученические статусы." />
      </div>

      <SectionCard
        title="Общий охват по платформе"
        description="Насколько заполнены статусы и какая доля тем уже действительно используется учениками."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:rounded-[28px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Заполненные статусы</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {data.stats.totalMarked} / {totalStatusSlots || 0}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-950">{markedPercent}%</p>
            </div>
            <div className="mt-4">
              <ProgressBar value={markedPercent} />
            </div>
          </article>

          <article className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:rounded-[28px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Активные темы</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {activeTopics.length} / {data.stats.totalTopics}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-950">{activeTopicsPercent}%</p>
            </div>
            <div className="mt-4">
              <ProgressBar value={activeTopicsPercent} />
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard
        title="Темы по активности"
        description="Сводка по каждой теме: сколько учеников в ней отметились и насколько заполнены статусы."
      >
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Пока нет статистики по темам</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Когда появятся темы и статусы учеников, здесь автоматически появится сводка по активности.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => (
              <article
                key={topic.id}
                className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 sm:rounded-[28px] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.55rem]">
                      {topic.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {topic.totalNumbers} номеров · {topic.studentsWithActivity} активных учеников
                    </p>
                  </div>
                  <p className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-700">
                    {topic.progressPercent}%
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>Заполненные статусы</span>
                      <span className="font-semibold text-slate-950">
                        {topic.markedCount} / {topic.totalSlots}
                      </span>
                    </div>
                    <ProgressBar value={topic.progressPercent} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Зеленые</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{topic.greenCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Желтые</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{topic.yellowCount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Красные</p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{topic.redCount}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
