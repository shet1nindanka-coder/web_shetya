import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import {
  acquireDashboardRealtimeConnection,
  DASHBOARD_REALTIME_MAX_CONNECTIONS_PER_USER,
  publishDashboardRealtimeEvent,
  shouldReceiveDashboardRealtimeEvent,
  subscribeDashboardRealtimeEvent
} from "../lib/dashboard-realtime";

test("realtime connection limiter caps concurrent connections per user and releases slots", () => {
  const userId = `connection-test-${Date.now()}`;
  const releases = Array.from(
    { length: DASHBOARD_REALTIME_MAX_CONNECTIONS_PER_USER },
    () => acquireDashboardRealtimeConnection(userId)
  );

  assert.equal(releases.every((release) => typeof release === "function"), true);
  assert.equal(acquireDashboardRealtimeConnection(userId), null);

  releases[0]?.();
  const replacementRelease = acquireDashboardRealtimeConnection(userId);
  assert.equal(typeof replacementRelease, "function");

  replacementRelease?.();
  releases.slice(1).forEach((release) => release?.());
});

test("realtime connection release is idempotent and isolated by user", () => {
  const firstUser = `connection-first-${Date.now()}`;
  const secondUser = `connection-second-${Date.now()}`;
  const firstReleases = Array.from(
    { length: DASHBOARD_REALTIME_MAX_CONNECTIONS_PER_USER },
    () => acquireDashboardRealtimeConnection(firstUser)
  );
  const secondRelease = acquireDashboardRealtimeConnection(secondUser);

  assert.equal(firstReleases.every((release) => typeof release === "function"), true);
  assert.equal(acquireDashboardRealtimeConnection(firstUser), null);
  assert.equal(typeof secondRelease, "function");

  firstReleases[0]?.();
  firstReleases[0]?.();

  const reacquired = acquireDashboardRealtimeConnection(firstUser);
  assert.equal(typeof reacquired, "function");

  reacquired?.();
  firstReleases.slice(1).forEach((release) => release?.());
  secondRelease?.();
});

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

test("shouldReceiveDashboardRealtimeEvent: lesson-activity доставляется учителю, разработчику и своему ученику", () => {
  const teacher = { id: "teacher-1", role: UserRole.TEACHER };
  const developer = { id: "dev-1", role: UserRole.DEVELOPER };
  const student = { id: "student-1", role: UserRole.STUDENT };
  const otherStudent = { id: "student-2", role: UserRole.STUDENT };
  const event = {
    kind: "lesson-activity" as const,
    occurredAt: "2026-09-01T12:00:00.000Z",
    lessonId: "lesson-1",
    teacherId: "teacher-1",
    studentId: "student-1"
  };

  assert.equal(shouldReceiveDashboardRealtimeEvent(teacher, event), true);
  assert.equal(shouldReceiveDashboardRealtimeEvent(developer, event), true);
  assert.equal(shouldReceiveDashboardRealtimeEvent(student, event), true);
  assert.equal(shouldReceiveDashboardRealtimeEvent(otherStudent, event), false);
});

test("shouldReceiveDashboardRealtimeEvent: DEVELOPER получает события прогресса, как учитель", () => {
  const developer = { id: "dev-1", role: UserRole.DEVELOPER };

  assert.equal(
    shouldReceiveDashboardRealtimeEvent(developer, {
      kind: "student-progress-changed",
      occurredAt: "2026-09-01T12:00:00.000Z",
      studentId: "student-1",
      topicId: "topic-1"
    }),
    true
  );
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
