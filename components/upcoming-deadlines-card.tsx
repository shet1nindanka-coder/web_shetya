import { DeadlineList } from "@/components/deadline-list";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";

type UpcomingDeadlinesCardProps = {
  deadlines: StudentDeadlineAssignment[];
  title?: string;
  description?: string;
  limit?: number;
};

export function UpcomingDeadlinesCard({
  deadlines,
  title = "Ближайшие ДЗ",
  description = "Какие домашние задания нужно закрыть в первую очередь.",
  limit = 5
}: UpcomingDeadlinesCardProps) {
  const upcoming = deadlines
    .slice()
    .sort((left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime())
    .slice(0, limit);

  return (
    <section className="ui-section-card ui-fade-slide ui-surface rounded-[8px] border p-3.5 sm:rounded-[10px] sm:p-4 lg:rounded-[12px] lg:p-5">
      <div className="mb-3.5 border-b pb-3.5">
        <h2 className="font-display text-[1.15rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.3rem] lg:text-[1.45rem]">
          {title}
        </h2>
        <p className="ui-hint ui-copy-muted mt-1 max-w-2xl text-sm leading-relaxed">{description}</p>
      </div>
      <DeadlineList items={upcoming} emptyMessage="Пока нет назначенных ДЗ." />
    </section>
  );
}
