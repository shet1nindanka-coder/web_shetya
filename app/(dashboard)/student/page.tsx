import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { StudentWeeklyActivity } from "@/components/student-weekly-activity";
import { UpcomingDeadlinesCard } from "@/components/upcoming-deadlines-card";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";
import { getStudentStreakSnapshot } from "@/lib/student-streak";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const [deadlines, streak] = await Promise.all([
    getStudentDeadlines(user.id),
    getStudentStreakSnapshot(user.id)
  ]);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Обзор"
        title="Ваш кабинет"
        description="Только то, что помогает понять следующий шаг в учебе."
      />

      <UpcomingDeadlinesCard deadlines={assignmentDeadlines} limit={4} />

      <StudentWeeklyActivity streak={streak} />
    </div>
  );
}
