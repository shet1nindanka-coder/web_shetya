import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);
  const deadlines = await getStudentDeadlines(user.id);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);

  return (
    <div className="space-y-5 sm:space-y-6 min-h-[70vh]">
      <PageHeader
        eyebrow="Дедлайны"
        title="Календарь домашних заданий"
        description="Отмечайте приоритет на ближайшие дни и не пропускайте сроки."
      />

      <DeadlinesCalendar deadlines={assignmentDeadlines} />
    </div>
  );
}
