import test from "node:test";
import assert from "node:assert/strict";
import { deriveLessonStatus } from "../lib/lesson-status";

const START = Date.parse("2026-08-20T15:00:00+03:00");
const MINUTE = 60_000;

test("deriveLessonStatus: до начала — PLANNED, во время — ACTIVE, после — FINISHED", () => {
  const lesson = { startsAt: new Date(START), durationMinutes: 60, status: "PLANNED" };

  assert.equal(deriveLessonStatus(lesson, START - MINUTE), "PLANNED");
  assert.equal(deriveLessonStatus(lesson, START), "ACTIVE");
  assert.equal(deriveLessonStatus(lesson, START + 59 * MINUTE), "ACTIVE");
  assert.equal(deriveLessonStatus(lesson, START + 60 * MINUTE), "FINISHED");
  assert.equal(deriveLessonStatus(lesson, START + 24 * 60 * MINUTE), "FINISHED");
});

test("deriveLessonStatus: строковая дата из БД/JSON работает так же", () => {
  const lesson = { startsAt: "2026-08-20T15:00:00+03:00", durationMinutes: 90, status: "PLANNED" };

  assert.equal(deriveLessonStatus(lesson, START + 89 * MINUTE), "ACTIVE");
  assert.equal(deriveLessonStatus(lesson, START + 90 * MINUTE), "FINISHED");
});

test("deriveLessonStatus: без даты — статус из БД, мусорный статус → PLANNED", () => {
  assert.equal(deriveLessonStatus({ startsAt: null, durationMinutes: 60, status: "FINISHED" }, START), "FINISHED");
  assert.equal(deriveLessonStatus({ startsAt: null, durationMinutes: 60, status: "ACTIVE" }, START), "ACTIVE");
  assert.equal(deriveLessonStatus({ startsAt: null, durationMinutes: 60, status: "garbage" }, START), "PLANNED");
  assert.equal(deriveLessonStatus({ startsAt: "not-a-date", durationMinutes: 60, status: "ACTIVE" }, START), "ACTIVE");
});

test("deriveLessonStatus: нулевая длительность не даёт вечного ACTIVE", () => {
  const lesson = { startsAt: new Date(START), durationMinutes: 0, status: "PLANNED" };

  assert.equal(deriveLessonStatus(lesson, START), "FINISHED");
});
