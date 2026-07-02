import { DeadlineList } from "@/components/deadline-list";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";

type UpcomingDeadlinesCardProps = {
  deadlines: StudentDeadlineAssignment[];
  title?: string;
  limit?: number;
};

export function UpcomingDeadlinesCard({ deadlines, title = "Ближайшие ДЗ", limit = 5 }: UpcomingDeadlinesCardProps) {
  const upcoming = deadlines
    .slice()
    .sort((left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime())
    .slice(0, limit);

  return (
    <section>
      <h2 className="shbz-section-title">{title}</h2>
      <DeadlineList items={upcoming} emptyMessage="Пока нет назначенных ДЗ." />
    </section>
  );
}
