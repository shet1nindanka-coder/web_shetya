import { HomeworkNumberStatus } from "@prisma/client";
import { buildGroupStatistics, type GroupMemberActivity, type GroupStatistics } from "@/lib/group-statistics";
import { getProgressTimeline, type TeacherViewer } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { buildStudentStreak } from "@/lib/student-streak";

/*
 * Сбор метрик участников группы для раздела «Статистика группы».
 * Живёт отдельно от platform-data, потому что тянет student-streak (который сам
 * импортирует platform-data) — так нет циклического импорта.
 * Таймлайн на 112 дней по каждому участнику: из него и стрик, и счётчики за 7/30 дней.
 */

const TIMELINE_DAYS = 112;

export async function getGroupStatistics(
  viewer: TeacherViewer,
  members: Array<{ id: string; name: string }>,
  now = new Date()
): Promise<GroupStatistics> {
  if (members.length === 0) {
    return buildGroupStatistics([], now);
  }

  const memberIds = members.map((member) => member.id);

  const [timelines, lastActivity, assignments, greenStatuses] = await Promise.all([
    Promise.all(memberIds.map((id) => getProgressTimeline(id, TIMELINE_DAYS, viewer))),
    // Та же логика, что у таймлайна: statusChangedAt, а для строк без него
    // (до бэкфилла) — updatedAt, иначе «последняя активность» расходится со счётчиками.
    prisma.studentTopicNumberStatus.findMany({
      where: { studentId: { in: memberIds }, status: { not: null } },
      select: { studentId: true, statusChangedAt: true, updatedAt: true }
    }),
    prisma.homeworkAssignment.findMany({
      where: { studentId: { in: memberIds } },
      select: { studentId: true, deadlineAt: true, numbers: { select: { homeworkNumberId: true } } }
    }),
    prisma.studentTopicNumberStatus.findMany({
      where: { studentId: { in: memberIds }, status: HomeworkNumberStatus.GREEN },
      select: { studentId: true, homeworkNumberId: true }
    })
  ]);

  const lastActivityById = new Map<string, Date>();
  for (const row of lastActivity) {
    const at = row.statusChangedAt ?? row.updatedAt;
    const current = lastActivityById.get(row.studentId);
    if (!current || at.getTime() > current.getTime()) lastActivityById.set(row.studentId, at);
  }
  const solvedKeys = new Set(greenStatuses.map((row) => `${row.studentId}:${row.homeworkNumberId}`));
  const homeworkById = new Map<string, { overdue: number; active: number }>();

  for (const assignment of assignments) {
    const entry = homeworkById.get(assignment.studentId) ?? { overdue: 0, active: 0 };
    const total = assignment.numbers.length;
    const solved = assignment.numbers.filter((n) => solvedKeys.has(`${assignment.studentId}:${n.homeworkNumberId}`)).length;
    const completed = total > 0 && solved === total;

    if (!completed) {
      if (assignment.deadlineAt && assignment.deadlineAt.getTime() < now.getTime()) entry.overdue += 1;
      else entry.active += 1;
    }

    homeworkById.set(assignment.studentId, entry);
  }

  const activity: GroupMemberActivity[] = members.map((member, index) => {
    const timeline = timelines[index];
    const last7 = timeline.slice(-7);
    const last30 = timeline.slice(-30);
    const homework = homeworkById.get(member.id) ?? { overdue: 0, active: 0 };

    return {
      id: member.id,
      name: member.name,
      closed7: last7.reduce((sum, entry) => sum + entry.closedCount, 0),
      closed30: last30.reduce((sum, entry) => sum + entry.closedCount, 0),
      red30: last30.reduce((sum, entry) => sum + entry.redCount, 0),
      streak: buildStudentStreak(timeline).currentStreak,
      overdueHomeworks: homework.overdue,
      activeHomeworks: homework.active,
      lastActivityAt: lastActivityById.get(member.id) ?? null
    };
  });

  return buildGroupStatistics(activity, now);
}
