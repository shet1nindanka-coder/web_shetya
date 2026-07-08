import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentHomeworks } from "@/lib/platform-data";
import { mapStudentHomeworksToDeadlineItems } from "@/lib/student-deadline-groups";

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);
  const homeworks = await getStudentHomeworks(user.id);
  const assignmentDeadlines = mapStudentHomeworksToDeadlineItems(homeworks.assignments);

  return (
    <div className="min-h-[70vh]">
      <ShbzPageHeader kicker="Дедлайны" title="Календарь домашних заданий" aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />} />

      <DeadlinesCalendar deadlines={assignmentDeadlines} />
    </div>
  );
}
