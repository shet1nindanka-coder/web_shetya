import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import {
  buildProgressTimelineView,
  buildTeacherProgressTimeline,
  formatProgressTrend,
  type TimelineEntry
} from "../lib/progress-timeline";

test("buildTeacherProgressTimeline groups solved and review updates into daily and weekly buckets", () => {
  const now = new Date("2026-04-10T12:00:00.000Z");
  const result = buildTeacherProgressTimeline(
    [
      {
        homeworkNumbers: [
          {
            statuses: [
              {
                studentId: "student-1",
                status: HomeworkNumberStatus.GREEN,
                updatedAt: "2026-04-10T10:00:00.000Z"
              },
              {
                studentId: "student-2",
                status: HomeworkNumberStatus.YELLOW,
                updatedAt: "2026-04-08T08:00:00.000Z"
              },
              {
                studentId: "student-1",
                status: HomeworkNumberStatus.RED,
                updatedAt: "2026-04-03T09:00:00.000Z"
              },
              {
                studentId: "student-3",
                status: HomeworkNumberStatus.GREEN,
                updatedAt: "2026-03-20T09:00:00.000Z"
              }
            ]
          }
        ]
      }
    ],
    now
  );

  assert.equal(result.solvedLast7Days, 2);
  assert.equal(result.reviewLast30Days, 1);
  assert.equal(result.activeStudentsLast30Days, 3);
  assert.equal(result.activeDaysLast30Days, 4);
  assert.equal(result.daily.length, 7);
  assert.equal(result.weekly.length, 8);

  const todayBucket = result.daily.at(-1);
  const currentWeekBucket = result.weekly.at(-1);

  assert.equal(todayBucket?.solved, 1);
  assert.equal(todayBucket?.review, 0);
  assert.equal(result.daily.some((point) => point.review > 0), false);
  assert.equal(currentWeekBucket?.solved, 2);
});

test("formatProgressTrend produces human-readable delta text", () => {
  assert.equal(formatProgressTrend(6, 3), "+3 (+100%) к прошлому периоду");
  assert.equal(formatProgressTrend(0, 0), "без изменений к прошлому периоду");
  assert.equal(formatProgressTrend(4, 0), "новая активность в этом периоде");
  assert.equal(formatProgressTrend(2, 5), "-3 (-60%) к прошлому периоду");
});

test("buildTeacherProgressTimeline can be filtered to one student", () => {
  const now = new Date("2026-04-10T12:00:00.000Z");
  const result = buildTeacherProgressTimeline(
    [
      {
        homeworkNumbers: [
          {
            statuses: [
              {
                studentId: "student-1",
                status: HomeworkNumberStatus.GREEN,
                updatedAt: "2026-04-10T10:00:00.000Z"
              },
              {
                studentId: "student-2",
                status: HomeworkNumberStatus.RED,
                updatedAt: "2026-04-09T10:00:00.000Z"
              }
            ]
          }
        ]
      }
    ],
    now,
    { studentId: "student-2" }
  );

  assert.equal(result.solvedLast7Days, 0);
  assert.equal(result.reviewLast30Days, 1);
  assert.equal(result.activeStudentsLast30Days, 1);
  assert.equal(result.activeDaysLast30Days, 1);
});

test("buildProgressTimelineView creates a 7-day chart model with trend", () => {
  const entries = createTimelineEntries(112);

  setTimelineEntry(entries, "2026-04-04", 0, 0);
  setTimelineEntry(entries, "2026-04-05", 0, 0);
  setTimelineEntry(entries, "2026-04-06", 1, 0);
  setTimelineEntry(entries, "2026-04-07", 0, 1);
  setTimelineEntry(entries, "2026-04-08", 2, 0);
  setTimelineEntry(entries, "2026-04-09", 0, 0);
  setTimelineEntry(entries, "2026-04-10", 3, 1);

  setTimelineEntry(entries, "2026-03-28", 1, 0);
  setTimelineEntry(entries, "2026-03-29", 0, 0);
  setTimelineEntry(entries, "2026-03-30", 0, 0);
  setTimelineEntry(entries, "2026-03-31", 1, 0);
  setTimelineEntry(entries, "2026-04-01", 0, 0);
  setTimelineEntry(entries, "2026-04-02", 0, 0);
  setTimelineEntry(entries, "2026-04-03", 0, 0);

  const result = buildProgressTimelineView(entries, "7d");

  assert.equal(result.points.length, 7);
  assert.equal(result.closedTotal, 6);
  assert.equal(result.redTotal, 2);
  assert.equal(result.totalChanges, 8);
  assert.equal(result.trend.direction, "up");
  assert.match(result.trend.label, /\+4 закрыто/);
  assert.equal(result.points.at(-1)?.label, "10 апр.");
  assert.equal(result.points.at(-1)?.totalCount, 4);
});

test("buildProgressTimelineView groups daily entries into weekly buckets", () => {
  const entries = createTimelineEntries(112);

  for (let index = 0; index < 28; index += 1) {
    const date = new Date("2026-03-14T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);

    setTimelineEntry(entries, date.toISOString().slice(0, 10), 1, index % 7 === 0 ? 1 : 0);
  }

  const result = buildProgressTimelineView(entries, "4w");

  assert.equal(result.points.length, 4);
  assert.equal(result.closedTotal, 28);
  assert.equal(result.redTotal, 4);
  assert.equal(result.points[0]?.closedCount, 7);
  assert.equal(result.points[0]?.redCount, 1);
  assert.match(result.points[0]?.tooltip ?? "", /14 марта 2026/);
});

function createTimelineEntries(days: number): TimelineEntry[] {
  const start = new Date("2025-12-20T00:00:00.000Z");

  return Array.from({ length: days }, (_, index) => {
    const current = new Date(start);
    current.setUTCDate(current.getUTCDate() + index);

    return {
      date: current.toISOString().slice(0, 10),
      closedCount: 0,
      redCount: 0
    };
  });
}

function setTimelineEntry(entries: TimelineEntry[], date: string, closedCount: number, redCount: number) {
  const target = entries.find((entry) => entry.date === date);

  assert.ok(target, `Timeline entry not found for ${date}`);

  target.closedCount = closedCount;
  target.redCount = redCount;
}
