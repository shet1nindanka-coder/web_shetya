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

test("deriveLessonStatus: досрочное завершение (finishedAt) перекрывает расписание", () => {
  const lesson = {
    startsAt: new Date(START),
    durationMinutes: 60,
    status: "PLANNED",
    finishedAt: new Date(START + 30 * MINUTE)
  };

  // Урок завершили на 30-й минуте — с этого момента FINISHED, хотя по расписанию он ещё идёт.
  assert.equal(deriveLessonStatus(lesson, START + 31 * MINUTE), "FINISHED");
  // До момента завершения производная работает как раньше.
  assert.equal(deriveLessonStatus(lesson, START + 10 * MINUTE), "ACTIVE");
});

test("deriveLessonStatus: finishedAt работает и для урока без расписания", () => {
  const lesson = { startsAt: null, durationMinutes: 60, status: "PLANNED", finishedAt: new Date(START) };

  assert.equal(deriveLessonStatus(lesson, START + MINUTE), "FINISHED");
});

test("deriveLessonStatus: мусорный finishedAt игнорируется", () => {
  const lesson = { startsAt: new Date(START), durationMinutes: 60, status: "PLANNED", finishedAt: "not-a-date" };

  assert.equal(deriveLessonStatus(lesson, START + MINUTE), "ACTIVE");
});
