import { DeadlineList, type DeadlineListItem } from "@/components/deadline-list";

type UpcomingDeadlinesCardProps = {
  deadlines: DeadlineListItem[];
  title?: string;
  limit?: number;
};

export function UpcomingDeadlinesCard({ deadlines, title = "Ближайшие ДЗ", limit = 5 }: UpcomingDeadlinesCardProps) {
  const upcoming = deadlines
    .filter((item) => !(item.status === "DONE" && new Date(item.deadlineAt).getTime() < Date.now()))
    .sort((left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime())
    .slice(0, limit);

  return (
    <section>
      <h2 className="shbz-section-title">{title}</h2>
      <DeadlineList items={upcoming} emptyMessage="Пока нет назначенных ДЗ." />
    </section>
  );
}
