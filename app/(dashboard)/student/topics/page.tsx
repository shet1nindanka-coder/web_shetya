import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentTopicsPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Темы"
        title="Список тем"
        description="Откройте нужную тему и продолжайте работу по заданиям."
      />

      <SectionCard title="Список тем">
        {data.topics.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center sm:rounded-[20px] sm:px-5 sm:py-10">
            <p className="font-display text-lg font-semibold text-slate-950 sm:text-xl">Темы пока не добавлены</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {data.topics.map((topic) => {
              const solvedCount = topic.greenCount + topic.yellowCount;
              const solvedPercent = topic.totalNumbers > 0 ? Math.round((solvedCount / topic.totalNumbers) * 100) : 0;

              return (
                <article key={topic.id} className="ui-surface rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="font-display text-[1.1rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.25rem]">
                        {topic.title}
                      </h2>
                      {topic.description ? (
                        <p className="ui-hint max-w-2xl text-sm leading-relaxed text-[var(--theme-text-muted)]">{topic.description}</p>
                      ) : null}
                      <p className="text-sm text-[var(--theme-text-muted)]">
                        {solvedCount} из {topic.totalNumbers} задач выполнено
                      </p>
                      <ProgressBar value={solvedPercent} size="sm" />
                    </div>

                    <Link
                      href={`/student/topics/${topic.id}`}
                      className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
                    >
                      Открыть
                    </Link>
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
