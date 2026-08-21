import { ParentCallOutcome, UserRole } from "@prisma/client";
import { createNotification } from "@/lib/notifications";
import {
  PARENT_CALL_OVERDUE_DAYS,
  calendarDaysBetween,
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

/** История в развёртке ограничена: журнал append-only и растёт бесконечно. */
export const PARENT_CALL_HISTORY_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

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
  /** Была ли неудачная попытка позже последнего успешного звонка. */
  attemptAfterLastReached: boolean;
  /** Календарных дней с последней неудачной попытки (для меты), если она есть. */
  attemptDaysAgo: number | null;
  totalCalls: number;
  /** Последние записи (новые сверху), не больше PARENT_CALL_HISTORY_LIMIT. */
  history: ParentCallEntry[];
};

type OverviewViewer = { id: string; role: UserRole };

// Стабильный порядок при совпадении calledAt (двойная отправка в одну секунду):
// cuid монотонен по времени создания.
const CALL_ORDER = [{ calledAt: "desc" }, { id: "desc" }] as const;

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
      _count: { select: { parentCallsAsStudent: true } },
      parentCallsAsStudent: {
        orderBy: [...CALL_ORDER],
        take: PARENT_CALL_HISTORY_LIMIT,
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

  // Последний успешный звонок может быть старше PARENT_CALL_HISTORY_LIMIT
  // попыток — берём его отдельным групповым запросом, а не из среза истории.
  const lastReachedByStudent = new Map<string, Date>();

  if (students.length > 0) {
    const grouped = await prisma.parentCallLog.groupBy({
      by: ["studentId"],
      where: {
        outcome: ParentCallOutcome.REACHED,
        studentId: { in: students.map((student) => student.id) }
      },
      _max: { calledAt: true }
    });

    for (const entry of grouped) {
      if (entry._max.calledAt) {
        lastReachedByStudent.set(entry.studentId, entry._max.calledAt);
      }
    }
  }

  const now = new Date();

  const overviews = students.map((student) => {
    const calls = student.parentCallsAsStudent;
    const lastReachedAt = lastReachedByStudent.get(student.id) ?? null;
    const lastAttempt = calls[0] ?? null;

    const reminder = resolveParentCallReminder({
      lastReachedAt,
      studentCreatedAt: student.createdAt,
      now
    });

    const attemptAfterLastReached =
      lastAttempt !== null &&
      lastAttempt.outcome === ParentCallOutcome.NO_ANSWER &&
      (lastReachedAt === null || lastAttempt.calledAt.getTime() > lastReachedAt.getTime());

    return {
      studentId: student.id,
      studentName: student.name,
      teacherId: student.teacherId,
      teacherName: student.teacher?.name ?? null,
      reminder,
      studentCreatedAt: student.createdAt.toISOString(),
      lastReachedAt: lastReachedAt ? lastReachedAt.toISOString() : null,
      attemptAfterLastReached,
      attemptDaysAgo:
        attemptAfterLastReached && lastAttempt ? Math.max(0, calendarDaysBetween(lastAttempt.calledAt, now)) : null,
      totalCalls: student._count.parentCallsAsStudent,
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

/**
 * Лёгкая сводка для виджета обзора: только счётчики, без историй и комментариев
 * (комментарии — персональные данные, и виджету они не нужны).
 */
export async function getParentCallCounts(viewer: OverviewViewer): Promise<{ due: number; overdue: number }> {
  if (viewer.role !== UserRole.TEACHER && viewer.role !== UserRole.DEVELOPER) {
    return { due: 0, overdue: 0 };
  }

  const students = await prisma.user.findMany({
    where: studentScope(viewer),
    select: { id: true, createdAt: true }
  });

  if (students.length === 0) {
    return { due: 0, overdue: 0 };
  }

  const grouped = await prisma.parentCallLog.groupBy({
    by: ["studentId"],
    where: {
      outcome: ParentCallOutcome.REACHED,
      studentId: { in: students.map((student) => student.id) }
    },
    _max: { calledAt: true }
  });

  const lastReachedByStudent = new Map(grouped.map((entry) => [entry.studentId, entry._max.calledAt]));
  const now = new Date();
  let due = 0;
  let overdue = 0;

  for (const student of students) {
    const reminder = resolveParentCallReminder({
      lastReachedAt: lastReachedByStudent.get(student.id) ?? null,
      studentCreatedAt: student.createdAt,
      now
    });

    if (reminder.state === "due") {
      due += 1;
    } else if (reminder.state === "overdue") {
      overdue += 1;
    }
  }

  return { due, overdue };
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

// Генерация напоминаний дёргается с каждого маунта колокольчика (их в шапке
// два: десктоп + мобильный) и со входа в раздел. Троттлим и дедупим по
// учителю: параллельные вызовы ждут один общий прогон, повторные — не чаще
// раза в минуту. In-memory — корректно на одном инстансе, как и весь realtime.
const ENSURE_THROTTLE_MS = 60_000;
const ensureRuns = new Map<string, { at: number; promise: Promise<void> }>();

/**
 * Ленивая генерация уведомлений «пора созвониться» для учителя. Дедупликация:
 * за период задолженности не больше двух уведомлений на ученика — «пора
 * позвонить» и эскалация «просрочено».
 */
export function ensureParentCallDueNotifications(teacherId: string): Promise<void> {
  const existing = ensureRuns.get(teacherId);
  const now = Date.now();

  if (existing && now - existing.at < ENSURE_THROTTLE_MS) {
    return existing.promise;
  }

  const promise = runEnsureParentCallDueNotifications(teacherId).finally(() => {
    // Метка времени остаётся — троттлинг продолжает действовать после завершения.
  });

  ensureRuns.set(teacherId, { at: now, promise });

  return promise;
}

async function runEnsureParentCallDueNotifications(teacherId: string): Promise<void> {
  const students = await prisma.user.findMany({
    where: { role: UserRole.STUDENT, teacherId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      parentCallsAsStudent: {
        where: { outcome: ParentCallOutcome.REACHED },
        orderBy: [...CALL_ORDER],
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
      overdueAt: new Date(anchorAt.getTime() + PARENT_CALL_OVERDUE_DAYS * DAY_MS),
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
