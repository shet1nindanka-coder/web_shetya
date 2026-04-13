import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { StudentWeeklyActivity } from "@/components/student-weekly-activity";
import { UpcomingDeadlinesCard } from "@/components/upcoming-deadlines-card";
import { requireUser } from "@/lib/auth";
import { getProgressTimeline, getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";
import { buildStudentStreak } from "@/lib/student-streak";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const [deadlines, progressTimeline] = await Promise.all([
    getStudentDeadlines(user.id),
    getProgressTimeline(user.id, 56)
  ]);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);
  const streak = buildStudentStreak(progressTimeline);

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
