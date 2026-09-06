import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus, LessonItemResult } from "@prisma/client";
import { decideProgressChange } from "../lib/progress-policy";

const started = new Date("2026-09-05T12:00:00Z");
const old = (status: HomeworkNumberStatus | null) => ({ status, statusChangedAt: new Date("2026-09-05T11:00:00Z") });

test("ручная отметка допускает понижение, очистку и повторное подтверждение", () => {
  assert.equal(decideProgressChange(old("GREEN"), { source: "teacher", status: "RED" }).status, "RED");
  assert.deepEqual(decideProgressChange(old("GREEN"), { source: "teacher", status: null }), {
    write: true, requestedStatus: null, status: null, reason: "changed"
  });
  assert.equal(decideProgressChange(old("GREEN"), { source: "teacher", status: "GREEN" }).reason, "reaffirmed");
  assert.equal(decideProgressChange(old("GREEN"), { source: "teacher", status: "GREEN" }).write, true);
});

test("ДЗ: верно сразу даёт GREEN, после ошибок — YELLOW", () => {
  for (const previous of [null, "RED", "YELLOW", "GREEN"] as const) {
    const result = decideProgressChange(old(previous), { source: "homework_check", verdict: "CORRECT", checkStartedAt: started });
    assert.equal(result.status, previous === "RED" || previous === "YELLOW" ? "YELLOW" : "GREEN");
    assert.equal(result.write, previous === null || previous === "RED");
  }
});

test("ДЗ: неопределённый вердикт и понижение не меняют статус", () => {
  for (const previous of [null, "RED", "YELLOW", "GREEN"] as const) {
    assert.deepEqual(decideProgressChange(old(previous), { source: "homework_check", verdict: "UNCERTAIN", checkStartedAt: started }), {
      write: false, requestedStatus: null, status: previous, reason: "uncertain"
    });
  }
  for (const previous of ["GREEN", "YELLOW"] as const) {
    const result = decideProgressChange(old(previous), { source: "homework_check", verdict: "INCORRECT", checkStartedAt: started });
    assert.equal(result.status, previous);
    assert.equal(result.requestedStatus, "RED");
    assert.equal(result.reason, "downgrade_blocked");
  }
});

test("свежая отметка и свежая очистка защищены от старой проверки ДЗ", () => {
  for (const status of ["RED", null] as const) {
    const current = { status, statusChangedAt: new Date(started.getTime() + 1) };
    const result = decideProgressChange(current, { source: "homework_check", verdict: "CORRECT", checkStartedAt: started });
    assert.equal(result.status, status);
    assert.equal(result.reason, "newer_status");
    assert.equal(result.write, false);
  }
  assert.equal(decideProgressChange({ status: "RED", statusChangedAt: started }, {
    source: "homework_check", verdict: "CORRECT", checkStartedAt: started
  }).write, true);
});

test("итоги урока сохраняют свои правила, включая понижение общего прогресса", () => {
  const mapping = { SOLVED: "GREEN", PARTIAL: "YELLOW", NOT_SOLVED: "RED" } as const;
  for (const result of Object.keys(mapping) as (keyof typeof mapping)[]) {
    for (const source of ["lesson_check", "lesson_end"] as const) {
      const decision = decideProgressChange(old("GREEN"), source === "lesson_check"
        ? { source, result, verdict: "CORRECT" } : { source, result });
      assert.equal(decision.status, mapping[result]);
      assert.equal(decision.write, true);
    }
  }
});

test("не успел и снятие не влияющего на прогресс итога сохраняют прежний статус", () => {
  for (const previousResult of [null, LessonItemResult.SKIPPED]) {
    const result = decideProgressChange(old("GREEN"), { source: "lesson_teacher", result: null, previousResult });
    assert.equal(result.write, false);
    assert.equal(result.status, "GREEN");
  }
  assert.equal(decideProgressChange(old("GREEN"), { source: "lesson_end", result: "SKIPPED" }).write, false);
  assert.equal(decideProgressChange(old("GREEN"), { source: "lesson_teacher", result: null, previousResult: "SOLVED" }).status, null);
});

test("вердикт урока без нового автоитога объясняет сохранение общего прогресса", () => {
  const protectedResult = decideProgressChange(old("GREEN"), { source: "lesson_check", result: null, verdict: "INCORRECT" });
  assert.equal(protectedResult.reason, "lesson_result_preserved");
  assert.equal(protectedResult.write, false);
  assert.equal(protectedResult.status, "GREEN");
  assert.equal(decideProgressChange(null, { source: "lesson_check", result: null, verdict: "UNCERTAIN" }).reason, "uncertain");
});
