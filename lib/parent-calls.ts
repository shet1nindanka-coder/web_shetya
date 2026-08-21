import { ParentCallOutcome, UserRole } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import {
  resolveParentCallReminder,
  shouldCreateParentCallNotification,
  type ParentCallReminder
} from "@/lib/parent-call-state";
import { prisma } from "@/lib/prisma";

/*
 * Звонки родителям: чтение сводки и истории, ленивые уведомления учителю.
 * Комментарии — персональные данные: наружу уходят только учителю-владельцу
 * и роли DEVELOPER, в логи никогда не пишутся (логируем только id).
 */

export const PARENT_CALL_NOTIFICATION_TYPE = "parent_call_due";

export type ParentCallEntry = {
  id: string;
  outcome: ParentCallOutcome;
  comment: string | null;
  calledAt: string;
  teacherName: string | null;
};

export type ParentCallStudentOverview = {
  studentId: string;
  studentName: string;
  teacherId: string | null;
  teacherName: string | null;
  reminder: ParentCallReminder;
  studentCreatedAt: string;
  lastReachedAt: string | null;
  lastAttemptAt: string | null;
  /** Была ли неудачная попытка позже последнего успешного звонка. */
  attemptAfterLastReached: boolean;
  totalCalls: number;
  history: ParentCallEntry[];
};

type OverviewViewer = { id: string; role: UserRole };

/** Ученики, чьи звонки видит пользователь: учитель — своих, разработчик — всех. */
function studentScope(viewer: OverviewViewer) {
  if (viewer.role === UserRole.DEVELOPER) {
    return { role: UserRole.STUDENT } as const;
  }

  return { role: UserRole.STUDENT, teacherId: viewer.id } as const;
}

export async function getParentCallOverview(viewer: OverviewViewer): Promise<ParentCallStudentOverview[]> {
  if (viewer.role !== UserRole.TEACHER && viewer.role !== UserRole.DEVELOPER) {
    return [];
  }

  const students = await prisma.user.findMany({
    where: studentScope(viewer),
    select: {
      id: true,
      name: true,
      createdAt: true,
      teacherId: true,
      teacher: { select: { name: true } },
      parentCallsAsStudent: {
        orderBy: { calledAt: "desc" },
        select: {
          id: true,
          outcome: true,
          comment: true,
          calledAt: true,
          teacher: { select: { name: true } }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  const now = new Date();

  const overviews = students.map((student) => {
    const calls = student.parentCallsAsStudent;
    const lastReached = calls.find((call) => call.outcome === ParentCallOutcome.REACHED) ?? null;
    const lastAttempt = calls[0] ?? null;

    const reminder = resolveParentCallReminder({
      lastReachedAt: lastReached?.calledAt ?? null,
      studentCreatedAt: student.createdAt,
      now
    });

    return {
      studentId: student.id,
      studentName: student.name,
      teacherId: student.teacherId,
      teacherName: student.teacher?.name ?? null,
      reminder,
      studentCreatedAt: student.createdAt.toISOString(),
      lastReachedAt: lastReached ? lastReached.calledAt.toISOString() : null,
      lastAttemptAt: lastAttempt ? lastAttempt.calledAt.toISOString() : null,
      attemptAfterLastReached:
        lastAttempt !== null &&
        lastAttempt.outcome === ParentCallOutcome.NO_ANSWER &&
        (lastReached === null || lastAttempt.calledAt.getTime() > lastReached.calledAt.getTime()),
      totalCalls: calls.length,
      history: calls.map((call) => ({
        id: call.id,
        outcome: call.outcome,
        comment: call.comment,
        calledAt: call.calledAt.toISOString(),
        teacherName: call.teacher?.name ?? null
      }))
    } satisfies ParentCallStudentOverview;
  });

  // Срочные сверху: просроченные, затем «пора», внутри группы — дольше всех без звонка.
  const stateOrder = { overdue: 0, due: 1, ok: 2 } as const;

  return overviews.sort((a, b) => {
    const byState = stateOrder[a.reminder.state] - stateOrder[b.reminder.state];

    if (byState !== 0) {
      return byState;
    }

    return b.reminder.daysSinceAnchor - a.reminder.daysSinceAnchor;
  });
}

/** Может ли пользователь видеть/фиксировать звонки этого ученика. */
export async function canAccessStudentParentCalls(
  viewer: OverviewViewer,
  studentId: string
): Promise<{ allowed: boolean; student: { id: string; name: string; teacherId: string | null } | null }> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, role: true, teacherId: true }
  });

  if (!student || student.role !== UserRole.STUDENT) {
    return { allowed: false, student: null };
  }

  if (viewer.role === UserRole.DEVELOPER) {
    return { allowed: true, student };
  }

  if (viewer.role === UserRole.TEACHER && student.teacherId === viewer.id) {
    return { allowed: true, student };
  }

  return { allowed: false, student: null };
}

/**
 * Ленивая генерация уведомлений «пора созвониться» для учителя: вызывается при
 * обращении к уведомлениям или разделу звонков. Дедупликация — не больше одного
 * уведомления на ученика за период задолженности (createdAt > якоря).
 */
export async function ensureParentCallDueNotifications(teacherId: string): Promise<void> {
  const students = await prisma.user.findMany({
    where: { role: UserRole.STUDENT, teacherId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      parentCallsAsStudent: {
        where: { outcome: ParentCallOutcome.REACHED },
        orderBy: { calledAt: "desc" },
        take: 1,
        select: { calledAt: true }
      }
    }
  });

  if (students.length === 0) {
    return;
  }

  const existing = await prisma.notification.findMany({
    where: { userId: teacherId, type: PARENT_CALL_NOTIFICATION_TYPE },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, href: true }
  });

  const now = new Date();

  for (const student of students) {
    const lastReachedAt = student.parentCallsAsStudent[0]?.calledAt ?? null;
    const reminder = resolveParentCallReminder({ lastReachedAt, studentCreatedAt: student.createdAt, now });
    const anchorAt = lastReachedAt ?? student.createdAt;
    const studentHref = `/teacher/calls?studentId=${student.id}`;
    const lastNotification = existing.find((entry) => entry.href === studentHref) ?? null;

    const needed = shouldCreateParentCallNotification({
      reminderState: reminder.state,
      anchorAt,
      lastNotificationCreatedAt: lastNotification?.createdAt ?? null
    });

    if (!needed) {
      continue;
    }

    // Тексты — из утверждённого UI-контракта (02-UI-SPEC.md); комментарии
    // звонков в уведомления не попадают никогда.
    await createNotification({
      userId: teacherId,
      type: PARENT_CALL_NOTIFICATION_TYPE,
      title: reminder.state === "overdue" ? "Звонок родителям просрочен" : "Пора позвонить родителям",
      body: reminder.hasReachedCall
        ? `${student.name}: последний звонок был ${reminder.daysSinceAnchor} дн. назад.`
        : `${student.name}: успешных звонков ещё не было.`,
      href: studentHref
    });
  }
}

/** После состоявшегося звонка гасим непрочитанные напоминания по этому ученику. */
export async function markParentCallNotificationsRead(teacherId: string, studentId: string): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: teacherId,
        type: PARENT_CALL_NOTIFICATION_TYPE,
        href: `/teacher/calls?studentId=${studentId}`,
        readAt: null
      },
      data: { readAt: new Date() }
    });
  } catch {
    // Отсутствие таблицы уведомлений не должно ломать фиксацию звонка.
  }
}
