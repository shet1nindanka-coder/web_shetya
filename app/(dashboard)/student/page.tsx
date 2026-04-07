import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { UpcomingDeadlinesCard } from "@/components/upcoming-deadlines-card";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines, getStudentTopicsOverview } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const [overview, deadlines] = await Promise.all([getStudentTopicsOverview(user.id), getStudentDeadlines(user.id)]);
  const normalizedDeadlines = deadlines
    .map((deadline) => {
      const deadlineAt = toIsoDateTimeString(deadline.deadlineAt);
      if (!deadlineAt) {
        return null;
      }

      return {
        ...deadline,
        deadlineAt
      };
    })
    .filter((deadline): deadline is NonNullable<typeof deadline> => Boolean(deadline));

  const topicToContinue =
    overview.topics.find(
      (topic) => topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount < topic.totalNumbers
    ) ?? overview.topics[0];
  const solvedCount = overview.stats.totalSolved;
  const totalCount = overview.stats.totalNumbers;

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Обзор"
        title="Ваш кабинет"
        description="Только то, что помогает понять следующий шаг в учебе."
      />

      <UpcomingDeadlinesCard deadlines={normalizedDeadlines} limit={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Продолжить работу" description="Откройте тему и продолжайте с текущего места.">
          <div className="space-y-3">
            {topicToContinue ? (
              <>
                <div className="ui-surface rounded-[14px] border px-3.5 py-3">
                  <p className="font-medium text-[var(--theme-text-strong)]">{topicToContinue.title}</p>
                  <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
                    {topicToContinue.greenCount + topicToContinue.yellowCount} из {topicToContinue.totalNumbers} задач выполнено
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/student/topics/${topicToContinue.id}`}
                    className="ui-pressable ui-button-primary inline-flex rounded-[10px] px-3.5 py-2 text-sm font-semibold"
                  >
                    Открыть тему
                  </Link>
                  <Link
                    href="/student/topics"
                    className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3.5 py-2 text-sm font-semibold"
                  >
                    Все темы
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--theme-text-muted)]">Темы пока не добавлены.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Короткий прогресс" description="Без лишней аналитики, только общий ориентир.">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
              <span>Решено</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {solvedCount} / {totalCount}
              </span>
            </div>
            <ProgressBar value={overview.stats.solvedPercent} />
            <div className="flex flex-wrap gap-2">
              <Link
                href="/student/deadlines"
                className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3 py-2 text-sm font-semibold"
              >
                Открыть дедлайны
              </Link>
              <Link
                href="/student/info"
                className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3 py-2 text-sm font-semibold"
              >
                Общая инфа
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
