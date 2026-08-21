import { UserRole } from "@prisma/client";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherParentCallsList } from "@/components/teacher-parent-calls-list";
import { requireUser } from "@/lib/auth";
import { logWarnEvent } from "@/lib/logger";
import { ensureParentCallDueNotifications, getParentCallOverview } from "@/lib/parent-calls";

export const dynamic = "force-dynamic";

type TeacherCallsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/*
 * Раздел «Звонки родителям». Учитель видит своих учеников и фиксирует звонки;
 * разработчик видит всех (контроль процесса), но записи не создаёт.
 * Комментарии — персональные данные: наружу из этого раздела не уходят.
 */
export default async function TeacherCallsPage({ searchParams }: TeacherCallsPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const isDeveloper = user.role === UserRole.DEVELOPER;

  const resolvedSearchParams = (await searchParams) ?? {};
  // Из уведомления приходят на конкретного ученика — подсветим его строку.
  const highlightStudentId =
    typeof resolvedSearchParams.studentId === "string" ? resolvedSearchParams.studentId : null;

  if (!isDeveloper) {
    // Заход в раздел — естественная точка ленивой генерации напоминаний.
    try {
      await ensureParentCallDueNotifications(user.id);
    } catch (error) {
      logWarnEvent(
        "notifications.parent_call_ensure.failed",
        { userId: user.id, source: "calls-page" },
        error,
        "Failed to ensure parent call notifications."
      );
    }
  }

  const students = await getParentCallOverview(user);

  return (
    <div>
      <ShbzPageHeader kicker="Звонки" title="Звонки родителям" />
      <TeacherParentCallsList
        students={students}
        isDeveloper={isDeveloper}
        studentsHref={isDeveloper ? "/developer/accounts" : "/teacher/students"}
        highlightStudentId={highlightStudentId}
      />
    </div>
  );
}
