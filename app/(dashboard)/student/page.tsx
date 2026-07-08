import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentWeeklyActivity } from "@/components/student-weekly-activity";
import { UpcomingDeadlinesCard } from "@/components/upcoming-deadlines-card";
import { requireUser } from "@/lib/auth";
import { getStudentHomeworks } from "@/lib/platform-data";
import { mapStudentHomeworksToDeadlineItems } from "@/lib/student-deadline-groups";
import { getStudentStreakSnapshot } from "@/lib/student-streak";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const [homeworks, streak] = await Promise.all([
    getStudentHomeworks(user.id),
    getStudentStreakSnapshot(user.id)
  ]);
  const assignmentDeadlines = mapStudentHomeworksToDeadlineItems(homeworks.assignments);

  return (
    <div>
      <ShbzPageHeader kicker="Обзор" title="Ваш кабинет" aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />} />

      <div className="space-y-11">
        <UpcomingDeadlinesCard deadlines={assignmentDeadlines} limit={4} />
        <StudentWeeklyActivity streak={streak} />
      </div>
    </div>
  );
}
