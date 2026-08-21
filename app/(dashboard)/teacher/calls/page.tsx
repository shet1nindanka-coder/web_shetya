import { UserRole } from "@prisma/client";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherParentCallsList } from "@/components/teacher-parent-calls-list";
import { requireUser } from "@/lib/auth";
import { ensureParentCallDueNotifications, getParentCallOverview } from "@/lib/parent-calls";

export const dynamic = "force-dynamic";

/*
 * Раздел «Звонки родителям». Учитель видит своих учеников и фиксирует звонки;
 * разработчик видит всех (контроль процесса), но записи не создаёт.
 * Комментарии — персональные данные: наружу из этого раздела не уходят.
 */
export default async function TeacherCallsPage() {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const isDeveloper = user.role === UserRole.DEVELOPER;

  if (!isDeveloper) {
    // Заход в раздел — естественная точка ленивой генерации напоминаний.
    await ensureParentCallDueNotifications(user.id).catch(() => undefined);
  }

  const students = await getParentCallOverview(user);

  return (
    <div>
      <ShbzPageHeader kicker="Звонки" title="Звонки родителям" />
      <TeacherParentCallsList
        students={students}
        isDeveloper={isDeveloper}
        studentsHref={isDeveloper ? "/developer/accounts" : "/teacher/students"}
      />
    </div>
  );
}
