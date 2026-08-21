import test from "node:test";
import assert from "node:assert/strict";
import {
  PARENT_CALL_DUE_DAYS,
  PARENT_CALL_OVERDUE_DAYS,
  calendarDaysBetween,
  resolveParentCallReminder,
  shouldCreateParentCallNotification
} from "../lib/parent-call-state";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number, now: Date) {
  return new Date(now.getTime() - days * DAY_MS);
}

test("свежий успешный звонок — состояние ok, дни до срока считаются", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const reminder = resolveParentCallReminder({
    lastReachedAt: daysAgo(10, now),
    studentCreatedAt: daysAgo(300, now),
    now
  });

  assert.equal(reminder.state, "ok");
  assert.equal(reminder.daysSinceAnchor, 10);
  assert.equal(reminder.daysUntilDue, PARENT_CALL_DUE_DAYS - 10);
  assert.equal(reminder.hasReachedCall, true);
});

test("30 дней с успешного звонка — пора позвонить", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const reminder = resolveParentCallReminder({
    lastReachedAt: daysAgo(PARENT_CALL_DUE_DAYS, now),
    studentCreatedAt: daysAgo(400, now),
    now
  });

  assert.equal(reminder.state, "due");
  assert.equal(reminder.daysUntilDue, 0);
});

test("45+ дней — просрочено", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const reminder = resolveParentCallReminder({
    lastReachedAt: daysAgo(PARENT_CALL_OVERDUE_DAYS, now),
    studentCreatedAt: daysAgo(400, now),
    now
  });

  assert.equal(reminder.state, "overdue");
});

test("успешных звонков не было — якорь от даты создания ученика", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const fresh = resolveParentCallReminder({
    lastReachedAt: null,
    studentCreatedAt: daysAgo(5, now),
    now
  });

  assert.equal(fresh.state, "ok");
  assert.equal(fresh.hasReachedCall, false);

  const stale = resolveParentCallReminder({
    lastReachedAt: null,
    studentCreatedAt: daysAgo(60, now),
    now
  });

  assert.equal(stale.state, "overdue");
});

test("граница 29/30/44/45 дней", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const created = daysAgo(400, now);

  const at = (days: number) =>
    resolveParentCallReminder({ lastReachedAt: daysAgo(days, now), studentCreatedAt: created, now }).state;

  assert.equal(at(29), "ok");
  assert.equal(at(30), "due");
  assert.equal(at(44), "due");
  assert.equal(at(45), "overdue");
});

test("дни считаются календарно: вчерашний вечерний звонок — «1 день назад»", () => {
  // Звонок 20 августа 23:00, взгляд 21 августа 09:00 — прошло 10 часов,
  // но по календарю это вчера: показываем 1 день, а не «сегодня».
  const now = new Date("2026-08-21T09:00:00+03:00");
  const reminder = resolveParentCallReminder({
    lastReachedAt: new Date("2026-08-20T23:00:00+03:00"),
    studentCreatedAt: new Date("2025-09-01T10:00:00+03:00"),
    now
  });

  assert.equal(reminder.daysSinceAnchor, 1);
});

test("calendarDaysBetween игнорирует время внутри суток", () => {
  assert.equal(
    calendarDaysBetween(new Date("2026-08-20T23:59:00+03:00"), new Date("2026-08-21T00:01:00+03:00")),
    1
  );
  assert.equal(
    calendarDaysBetween(new Date("2026-08-21T00:01:00+03:00"), new Date("2026-08-21T23:59:00+03:00")),
    0
  );
});

test("уведомления: одно на «пора», плюс эскалация на «просрочено»", () => {
  const anchor = new Date("2026-07-01T10:00:00+03:00");
  const overdueAt = new Date(anchor.getTime() + PARENT_CALL_OVERDUE_DAYS * DAY_MS);

  // Первый вход в «пора» — уведомление нужно.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "due",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: null
    }),
    true
  );

  // Уведомление о «пора» уже есть — второе в той же фазе не нужно.
  const dueNotification = new Date("2026-08-01T10:00:00+03:00");
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "due",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: dueNotification
    }),
    false
  );

  // Состояние стало «просрочено», а уведомление было только про «пора» —
  // эскалация нужна.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "overdue",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: dueNotification
    }),
    true
  );

  // Эскалационное уведомление уже создано — больше ничего не шлём.
  const overdueNotification = new Date(overdueAt.getTime() + DAY_MS);
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "overdue",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: overdueNotification
    }),
    false
  );

  // Уведомление прошлого периода (до якоря) не считается.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "due",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: new Date("2026-06-01T10:00:00+03:00")
    }),
    true
  );

  // Состояние ok — уведомление не создаётся никогда.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "ok",
      anchorAt: anchor,
      overdueAt,
      lastNotificationCreatedAt: null
    }),
    false
  );
});
