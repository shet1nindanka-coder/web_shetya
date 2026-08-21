/*
 * Чистая логика напоминаний о звонках родителям (без БД и сети).
 *
 * Якорь напоминания — последний звонок с исходом REACHED; если успешных звонков
 * не было, якорь — дата создания ученика (новому ученику нужно позвонить в
 * течение первого месяца). Неудачная попытка (NO_ANSWER) якорь не двигает.
 */

export const PARENT_CALL_DUE_DAYS = 30;
export const PARENT_CALL_OVERDUE_DAYS = 45;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ParentCallReminderState = "ok" | "due" | "overdue";

export type ParentCallReminder = {
  state: ParentCallReminderState;
  /** Полных дней с якоря (последний успешный звонок или создание ученика). */
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
  const daysSinceAnchor = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / DAY_MS));

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
 * Нужно ли создавать уведомление «пора созвониться»: не больше одного на пару
 * (учитель, ученик) в рамках одного периода задолженности — существующее
 * уведомление, созданное после якоря, гасит новое.
 */
export function shouldCreateParentCallNotification(input: {
  reminderState: ParentCallReminderState;
  anchorAt: Date;
  lastNotificationCreatedAt: Date | null;
}): boolean {
  if (input.reminderState === "ok") {
    return false;
  }

  if (!input.lastNotificationCreatedAt) {
    return true;
  }

  return input.lastNotificationCreatedAt.getTime() <= input.anchorAt.getTime();
}
