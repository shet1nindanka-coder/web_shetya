import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentTopicsPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);
  const completedTopics = data.topics.filter(
    (topic) => topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount === topic.totalNumbers
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Темы"
        title="Все темы"
        description="Откройте тему и продолжайте работу с того места, где остановились."
        metrics={[
          { label: "Всего тем", value: data.stats.totalTopics },
          { label: "Решено", value: `${data.stats.totalSolved} / ${data.stats.totalNumbers}` },
          { label: "Завершено", value: completedTopics, tone: "success" }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">По всем темам</p>
            <p className="mt-2 font-display text-[1.85rem] font-semibold text-[var(--theme-text-strong)]">
              {data.stats.totalSolved} / {data.stats.totalNumbers}
            </p>
            <p className="mt-2 text-sm text-[var(--theme-text-muted)]">Решённые номера по всем доступным темам.</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Завершены" value={completedTopics} />
        <StatCard label="Зеленые" value={data.stats.totalGreen} />
        <StatCard label="Желтые" value={data.stats.totalYellow} />
      </div>

      <SectionCard title="Список тем">
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Темы пока не добавлены</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => {
              const isCompleted = topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount === topic.totalNumbers;

              return (
                <article key={topic.id} className="ui-surface rounded-[20px] border p-4 sm:p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-display text-[1.45rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.7rem]">
                            {topic.title}
                          </h2>
                          {isCompleted ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">✓ Завершена</Badge>
                          ) : null}
                        </div>
                        {topic.description ? (
                          <p className="ui-hint max-w-2xl text-sm leading-6 text-[var(--theme-text-muted)]">{topic.description}</p>
                        ) : null}
                      </div>

                      <Link
                        href={`/student/topics/${topic.id}`}
                        className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto"
                      >
                        Открыть
                      </Link>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="ui-mini-stat-card">
                        <p className="ui-mini-stat-card-label">Номера</p>
                        <p className="ui-mini-stat-card-value mt-2">{topic.totalNumbers}</p>
                      </div>
                      <div className="ui-mini-stat-card">
                        <p className="ui-mini-stat-card-label">Решено</p>
                        <p className="ui-mini-stat-card-value mt-2">{topic.greenCount + topic.yellowCount}</p>
                      </div>
                      <div className="ui-mini-stat-card">
                        <p className="ui-mini-stat-card-label">Желтые</p>
                        <p className="ui-mini-stat-card-value mt-2 text-amber-700">{topic.yellowCount}</p>
                      </div>
                      <div className="ui-mini-stat-card">
                        <p className="ui-mini-stat-card-label">Красные</p>
                        <p className="ui-mini-stat-card-value mt-2 text-rose-700">{topic.redCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className="border-slate-200 bg-white text-slate-700">{topic.greenCount} зелёных</Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700">{topic.yellowCount} жёлтых</Badge>
                    <Badge className="border-slate-200 bg-white text-slate-700">{topic.redCount} красных</Badge>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
