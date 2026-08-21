/*
 * Чистая логика напоминаний о звонках родителям (без БД и сети).
 *
 * Якорь напоминания — последний звонок с исходом REACHED; если успешных звонков
 * не было, якорь — дата создания ученика (новому ученику нужно позвонить в
 * течение первого месяца). Неудачная попытка (NO_ANSWER) якорь не двигает.
 *
 * Дни считаются календарно в таймзоне процесса (приложение живёт с
 * TZ=Europe/Moscow): «1 день назад» — это «вчера», а не «24 часа назад».
 * Так «сегодня» здесь совпадает со стриками и дедлайнами.
 */

export const PARENT_CALL_DUE_DAYS = 30;
export const PARENT_CALL_OVERDUE_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Календарная разница в днях между двумя датами в локальной таймзоне. */
export function calendarDaysBetween(from: Date, to: Date): number {
  const fromDay = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS);
}

export type ParentCallReminderState = "ok" | "due" | "overdue";

export type ParentCallReminder = {
  state: ParentCallReminderState;
  /** Календарных дней с якоря (последний успешный звонок или создание ученика). */
  daysSinceAnchor: number;
  /** Через сколько дней наступит «пора позвонить»; 0, если уже наступило. */
  daysUntilDue: number;
  /** Был ли вообще успешный звонок (для копирайта «звонков ещё не было»). */
  hasReachedCall: boolean;
};

export function resolveParentCallReminder(input: {
  lastReachedAt: Date | null;
  studentCreatedAt: Date;
  now?: Date;
}): ParentCallReminder {
  const now = input.now ?? new Date();
  const anchor = input.lastReachedAt ?? input.studentCreatedAt;
  const daysSinceAnchor = Math.max(0, calendarDaysBetween(anchor, now));

  const state: ParentCallReminderState =
    daysSinceAnchor >= PARENT_CALL_OVERDUE_DAYS ? "overdue" : daysSinceAnchor >= PARENT_CALL_DUE_DAYS ? "due" : "ok";

  return {
    state,
    daysSinceAnchor,
    daysUntilDue: Math.max(0, PARENT_CALL_DUE_DAYS - daysSinceAnchor),
    hasReachedCall: input.lastReachedAt !== null
  };
}

/**
 * Нужно ли создавать уведомление «пора созвониться». За один период
 * задолженности уведомлений максимум два: одно при входе в «пора позвонить»
 * и одно эскалационное при входе в «просрочено» (иначе учитель, видевший
 * напоминание на 30-й день, никогда не узнал бы об эскалации на 45-й).
 */
export function shouldCreateParentCallNotification(input: {
  reminderState: ParentCallReminderState;
  anchorAt: Date;
  /** Момент, с которого состояние считается «просрочено» (якорь + 45 дней). */
  overdueAt: Date;
  lastNotificationCreatedAt: Date | null;
}): boolean {
  if (input.reminderState === "ok") {
    return false;
  }

  if (!input.lastNotificationCreatedAt) {
    return true;
  }

  // Уведомление из прошлого периода (создано до якоря) не считается.
  if (input.lastNotificationCreatedAt.getTime() <= input.anchorAt.getTime()) {
    return true;
  }

  // Эскалация: состояние уже «просрочено», а последнее уведомление было
  // создано ещё в фазе «пора позвонить».
  if (input.reminderState === "overdue" && input.lastNotificationCreatedAt.getTime() < input.overdueAt.getTime()) {
    return true;
  }

  return false;
}
