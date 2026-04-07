import { Suspense } from "react";
import { UserRole } from "@prisma/client";
import { DeadlinesCalendar } from "@/components/deadlines-calendar";
import { PageHeader } from "@/components/page-header";
import { StudentDeadlinesCalendarSkeleton } from "@/components/student-deadlines-calendar-skeleton";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";

async function StudentDeadlinesCalendarContent({ studentId }: { studentId: string }) {
  const deadlines = await getStudentDeadlines(studentId);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);

  return (
    <div className="ui-pop-in">
      <DeadlinesCalendar deadlines={assignmentDeadlines} />
    </div>
  );
}

export default async function StudentDeadlinesPage() {
  const user = await requireUser(UserRole.STUDENT);

  return (
    <div className="space-y-5 sm:space-y-6 min-h-[70vh]">
      <PageHeader
        eyebrow="Дедлайны"
        title="Календарь домашних заданий"
        description="Отмечайте приоритет на ближайшие дни и не пропускайте сроки."
      />

      <Suspense
        fallback={
          <div className="ui-pop-in">
            <StudentDeadlinesCalendarSkeleton />
          </div>
        }
      >
        <StudentDeadlinesCalendarContent studentId={user.id} />
      </Suspense>
    </div>
  );
}
