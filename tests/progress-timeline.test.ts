import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import { buildTeacherProgressTimeline, formatProgressTrend } from "../lib/progress-timeline";

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
