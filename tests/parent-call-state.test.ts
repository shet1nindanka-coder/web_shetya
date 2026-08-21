import test from "node:test";
import assert from "node:assert/strict";
import {
  PARENT_CALL_DUE_DAYS,
  PARENT_CALL_OVERDUE_DAYS,
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

test("часы внутри суток не влияют: неполный день не считается", () => {
  const now = new Date("2026-08-21T12:00:00+03:00");
  const reminder = resolveParentCallReminder({
    lastReachedAt: new Date(now.getTime() - (PARENT_CALL_DUE_DAYS * DAY_MS - 60_000)),
    studentCreatedAt: daysAgo(400, now),
    now
  });

  assert.equal(reminder.state, "ok");
  assert.equal(reminder.daysSinceAnchor, PARENT_CALL_DUE_DAYS - 1);
});

test("уведомление создаётся один раз за период задолженности", () => {
  const anchor = new Date("2026-07-01T10:00:00+03:00");

  assert.equal(
    shouldCreateParentCallNotification({ reminderState: "due", anchorAt: anchor, lastNotificationCreatedAt: null }),
    true
  );

  // Уведомление уже создано после якоря — новое не нужно.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "overdue",
      anchorAt: anchor,
      lastNotificationCreatedAt: new Date("2026-08-05T10:00:00+03:00")
    }),
    false
  );

  // Старое уведомление относится к прошлому периоду (создано до якоря) — нужно новое.
  assert.equal(
    shouldCreateParentCallNotification({
      reminderState: "due",
      anchorAt: anchor,
      lastNotificationCreatedAt: new Date("2026-06-01T10:00:00+03:00")
    }),
    true
  );

  // Состояние ok — уведомление не создаётся никогда.
  assert.equal(
    shouldCreateParentCallNotification({ reminderState: "ok", anchorAt: anchor, lastNotificationCreatedAt: null }),
    false
  );
});
