import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import {
  publishDashboardRealtimeEvent,
  shouldReceiveDashboardRealtimeEvent,
  subscribeDashboardRealtimeEvent
} from "../lib/dashboard-realtime";

test("publishDashboardRealtimeEvent notifies subscribers with occurredAt timestamp", async () => {
  const events: Array<{ kind: string; occurredAt: string }> = [];
  const unsubscribe = subscribeDashboardRealtimeEvent((event) => {
    events.push({ kind: event.kind, occurredAt: event.occurredAt });
  });

  try {
    publishDashboardRealtimeEvent({ kind: "students-changed" });
  } finally {
    unsubscribe();
  }

  assert.equal(events.length, 1);
  assert.equal(events[0]?.kind, "students-changed");
  assert.match(events[0]?.occurredAt ?? "", /^\d{4}-\d{2}-\d{2}T/);
});

test("unsubscribe stops further dashboard realtime notifications", () => {
  let calls = 0;
  const unsubscribe = subscribeDashboardRealtimeEvent(() => {
    calls += 1;
  });

  publishDashboardRealtimeEvent({ kind: "students-changed" });
  unsubscribe();
  publishDashboardRealtimeEvent({ kind: "students-changed" });

  assert.equal(calls, 1);
});

test("shouldReceiveDashboardRealtimeEvent filters events by role and student ownership", () => {
  const teacher = { id: "teacher-1", role: UserRole.TEACHER };
  const student = { id: "student-1", role: UserRole.STUDENT };

  assert.equal(
    shouldReceiveDashboardRealtimeEvent(teacher, { kind: "students-changed", occurredAt: "2026-04-08T12:00:00.000Z" }),
    true
  );
  assert.equal(
    shouldReceiveDashboardRealtimeEvent(student, { kind: "students-changed", occurredAt: "2026-04-08T12:00:00.000Z" }),
    false
  );
  assert.equal(
    shouldReceiveDashboardRealtimeEvent(student, {
      kind: "topic-content-changed",
      occurredAt: "2026-04-08T12:00:00.000Z",
      topicId: "topic-1"
    }),
    true
  );
  assert.equal(
    shouldReceiveDashboardRealtimeEvent(student, {
      kind: "student-progress-changed",
      occurredAt: "2026-04-08T12:00:00.000Z",
      studentId: "student-1",
      topicId: "topic-1"
    }),
    true
  );
  assert.equal(
    shouldReceiveDashboardRealtimeEvent(student, {
      kind: "student-progress-changed",
      occurredAt: "2026-04-08T12:00:00.000Z",
      studentId: "student-2",
      topicId: "topic-1"
    }),
    false
  );
});
