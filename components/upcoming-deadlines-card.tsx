import Link from "next/link";
import { DeadlineList, type DeadlineListItem } from "@/components/deadline-list";

type UpcomingDeadlinesCardProps = {
  deadlines: DeadlineListItem[];
  title?: string;
  limit?: number;
};

export function UpcomingDeadlinesCard({ deadlines, title = "Ближайшие ДЗ", limit = 5 }: UpcomingDeadlinesCardProps) {
  // Выполненные ДЗ не занимают слоты «что дальше» — даже с будущим дедлайном.
  const upcoming = deadlines
    .filter((item) => item.status !== "DONE")
    .sort((left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime())
    .slice(0, limit);
  const [next, ...rest] = upcoming;

  return (
    <section>
      {next ? (
        <>
          <h2 className="shbz-section-title">Что дальше</h2>
          <Link href={next.href} className="block no-underline">
            <DeadlineList items={[next]} compact />
          </Link>
        </>
      ) : null}

      {rest.length > 0 || !next ? (
        <>
          <h2 className={next ? "shbz-section-title mt-8" : "shbz-section-title"}>{title}</h2>
          <DeadlineList items={rest} emptyMessage="Пока нет назначенных ДЗ." />
        </>
      ) : null}
    </section>
  );
}
