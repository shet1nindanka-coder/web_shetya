import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);
  const deadlines = await getStudentDeadlines(user.id);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);

  return (
    <div className="min-h-[70vh]">
      <ShbzPageHeader kicker="Дедлайны" title="Календарь домашних заданий" aside={<ShbzNumberSearch />} />

      <DeadlinesCalendar deadlines={assignmentDeadlines} />
    </div>
  );
}
