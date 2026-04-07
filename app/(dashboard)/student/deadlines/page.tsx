import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);
  const deadlines = await getStudentDeadlines(user.id);
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Дедлайны"
        title="Календарь домашних заданий"
        description="Отмечайте приоритет на ближайшие дни и не пропускайте сроки."
      />

      <DeadlinesCalendar deadlines={normalizedDeadlines} />
    </div>
  );
}
