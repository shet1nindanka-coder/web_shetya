import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentStreak } from "../lib/student-streak";
import type { TimelineEntry } from "../lib/progress-timeline";

test("buildStudentStreak starts current streak from yesterday when today is empty", () => {
  const entries = createEntries([
    ["2026-04-04", 0, 0],
    ["2026-04-05", 1, 0],
    ["2026-04-06", 1, 0],
    ["2026-04-07", 0, 0],
    ["2026-04-08", 2, 0],
    ["2026-04-09", 1, 0],
    ["2026-04-10", 0, 0]
  ]);

  const result = buildStudentStreak(entries);

  assert.equal(result.currentStreak, 2);
  assert.equal(result.solvedToday, 0);
  assert.equal(result.solvedThisWeek, 5);
  assert.equal(result.activeDaysThisWeek, 4);
  assert.equal(result.dailyActivity.at(-1)?.dayLabel, "Пт");
});

test("buildStudentStreak tracks best streak across the whole period", () => {
  const entries = createEntries([
    ["2026-04-01", 1, 0],
    ["2026-04-02", 1, 0],
    ["2026-04-03", 1, 0],
    ["2026-04-04", 0, 0],
    ["2026-04-05", 2, 0],
    ["2026-04-06", 1, 0],
    ["2026-04-07", 1, 0],
    ["2026-04-08", 1, 0],
    ["2026-04-09", 0, 0],
    ["2026-04-10", 3, 0]
  ]);

  const result = buildStudentStreak(entries);

  assert.equal(result.bestStreak, 4);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.solvedToday, 3);
  assert.equal(result.activeDaysThisWeek, 5);
});

function createEntries(days: Array<[string, number, number]>): TimelineEntry[] {
  return days.map(([date, closedCount, redCount]) => ({
    date,
    closedCount,
    redCount
  }));
}
