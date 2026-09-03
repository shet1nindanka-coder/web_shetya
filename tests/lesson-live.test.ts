import test from "node:test";
import assert from "node:assert/strict";
import {
  canSubmitLessonItem,
  computeIdleLevel,
  computeSpentMinutes,
  decideAutoLessonResult,
  decideEndOfLessonResult,
  isExtraPartUnlocked,
  isLessonItemClosed
} from "../lib/lesson-live";

const NOW = Date.parse("2026-09-01T15:00:00+03:00");
const MINUTE = 60_000;

test("isLessonItemClosed: закрывают вердикт CORRECT и итоги SOLVED/PARTIAL/SKIPPED", () => {
  assert.equal(isLessonItemClosed({ isExtra: false, result: null, latestVerdict: "CORRECT" }), true);
  assert.equal(isLessonItemClosed({ isExtra: false, result: "SOLVED", latestVerdict: null }), true);
  assert.equal(isLessonItemClosed({ isExtra: false, result: "PARTIAL", latestVerdict: null }), true);
  assert.equal(isLessonItemClosed({ isExtra: false, result: "SKIPPED", latestVerdict: null }), true);
  // «Не решил» и INCORRECT не закрывают: номер можно перерешать прямо на уроке.
  assert.equal(isLessonItemClosed({ isExtra: false, result: "NOT_SOLVED", latestVerdict: "INCORRECT" }), false);
  assert.equal(isLessonItemClosed({ isExtra: false, result: null, latestVerdict: "UNCERTAIN" }), false);
  assert.equal(isLessonItemClosed({ isExtra: false, result: null, latestVerdict: null }), false);
});

test("canSubmitLessonItem: сдавать можно, пока номер не закрыт", () => {
  assert.equal(canSubmitLessonItem({ isExtra: false, result: null, latestVerdict: null }), true);
  assert.equal(canSubmitLessonItem({ isExtra: false, result: "NOT_SOLVED", latestVerdict: "INCORRECT" }), true);
  assert.equal(canSubmitLessonItem({ isExtra: false, result: "SOLVED", latestVerdict: null }), false);
  assert.equal(canSubmitLessonItem({ isExtra: false, result: null, latestVerdict: "CORRECT" }), false);
});

test("isExtraPartUnlocked: доп. часть открывается после закрытия всей основной", () => {
  const openMain = { isExtra: false, result: null, latestVerdict: null };
  const closedMain = { isExtra: false, result: "SOLVED", latestVerdict: null };
  const extra = { isExtra: true, result: null, latestVerdict: null };

  assert.equal(isExtraPartUnlocked([openMain, closedMain, extra]), false);
  assert.equal(isExtraPartUnlocked([closedMain, { ...openMain, latestVerdict: "CORRECT" }, extra]), true);
  // Набор из одних доп. номеров считается открытым — блокировать нечем.
  assert.equal(isExtraPartUnlocked([extra]), true);
});

test("computeIdleLevel: ступени простоя считаются от последнего действия", () => {
  const base = { lessonStartedAt: NOW - 60 * MINUTE, warnMinutes: 8, alertMinutes: 15 };

  assert.deepEqual(computeIdleLevel({ ...base, lastActivityAt: NOW - 3 * MINUTE }, NOW), {
    level: "ok",
    idleMinutes: 3
  });
  assert.deepEqual(computeIdleLevel({ ...base, lastActivityAt: NOW - 9 * MINUTE }, NOW), {
    level: "warn",
    idleMinutes: 9
  });
  assert.deepEqual(computeIdleLevel({ ...base, lastActivityAt: NOW - 20 * MINUTE }, NOW), {
    level: "alert",
    idleMinutes: 20
  });
});

test("computeIdleLevel: без действий якорь — начало урока", () => {
  const result = computeIdleLevel(
    { lastActivityAt: null, lessonStartedAt: NOW - 10 * MINUTE, warnMinutes: 8, alertMinutes: 15 },
    NOW
  );

  assert.deepEqual(result, { level: "warn", idleMinutes: 10 });
});

test("computeSpentMinutes: время на номер — от предыдущего события участника", () => {
  const started = NOW - 30 * MINUTE;
  const joined = NOW - 28 * MINUTE;
  const spent = computeSpentMinutes(
    [NOW - 20 * MINUTE, NOW - 5 * MINUTE],
    { lessonStartedAt: started, joinedAt: joined }
  );

  // Первая сдача: 28 - 20 = 8 минут от входа; вторая: 20 - 5 = 15 минут от прошлой сдачи.
  assert.deepEqual(spent, [8, 15]);
});

test("computeSpentMinutes: без joinedAt якорь — старт урока, отрицательных значений нет", () => {
  const started = NOW - 10 * MINUTE;
  const spent = computeSpentMinutes([started - MINUTE, NOW], { lessonStartedAt: started, joinedAt: null });

  assert.deepEqual(spent, [0, 10]);
});

test("decideAutoLessonResult: верно с первого раза — SOLVED, после ошибок — PARTIAL, неверно — NOT_SOLVED", () => {
  assert.equal(decideAutoLessonResult({ verdict: "CORRECT", currentResult: null, hadIncorrectBefore: false }), "SOLVED");
  assert.equal(decideAutoLessonResult({ verdict: "CORRECT", currentResult: null, hadIncorrectBefore: true }), "PARTIAL");
  assert.equal(decideAutoLessonResult({ verdict: "CORRECT", currentResult: "NOT_SOLVED", hadIncorrectBefore: false }), "PARTIAL");
  assert.equal(decideAutoLessonResult({ verdict: "INCORRECT", currentResult: null, hadIncorrectBefore: false }), "NOT_SOLVED");
  // Повторная ошибка ничего не меняет.
  assert.equal(decideAutoLessonResult({ verdict: "INCORRECT", currentResult: "NOT_SOLVED", hadIncorrectBefore: true }), null);
});

test("decideAutoLessonResult: не распознано и уже закрытые номера — итог не трогаем", () => {
  assert.equal(decideAutoLessonResult({ verdict: "UNCERTAIN", currentResult: null, hadIncorrectBefore: false }), null);
  assert.equal(decideAutoLessonResult({ verdict: "CORRECT", currentResult: "SOLVED", hadIncorrectBefore: false }), null);
  assert.equal(decideAutoLessonResult({ verdict: "INCORRECT", currentResult: "PARTIAL", hadIncorrectBefore: false }), null);
  assert.equal(decideAutoLessonResult({ verdict: "INCORRECT", currentResult: "SKIPPED", hadIncorrectBefore: false }), null);
});

test("decideEndOfLessonResult: без отметки — NOT_SOLVED, закрытая доп. часть — SKIPPED, отмеченные не трогаем", () => {
  assert.equal(decideEndOfLessonResult({ currentResult: null, isExtra: false, extraUnlocked: false }), "NOT_SOLVED");
  assert.equal(decideEndOfLessonResult({ currentResult: null, isExtra: true, extraUnlocked: true }), "NOT_SOLVED");
  assert.equal(decideEndOfLessonResult({ currentResult: null, isExtra: true, extraUnlocked: false }), "SKIPPED");
  assert.equal(decideEndOfLessonResult({ currentResult: "SOLVED", isExtra: false, extraUnlocked: true }), null);
});
