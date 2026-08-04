import assert from "node:assert/strict";
import test from "node:test";
import {
  UNCERTAIN_STUDENT_COMMENT,
  toStudentFacingResult,
  toStudentFacingResults
} from "@/lib/solution-check-student-view";

test("неуверенный вердикт больше не показывает ученику «Верно.»", () => {
  const view = toStudentFacingResult({
    number: "301",
    verdict: "UNCERTAIN",
    recognizedAnswer: "x = 5",
    comment: "Верно."
  });

  assert.equal(view.comment, UNCERTAIN_STUDENT_COMMENT);
  assert.equal(view.recognizedAnswer, null);
  assert.equal(view.verdict, "UNCERTAIN");
});

test("неуверенный вердикт без комментария всё равно получает объяснение", () => {
  const view = toStudentFacingResult({
    number: "301",
    verdict: "UNCERTAIN",
    recognizedAnswer: null,
    comment: null
  });

  assert.equal(view.comment, UNCERTAIN_STUDENT_COMMENT);
});

test("верный вердикт отдаётся как есть", () => {
  const source = { number: "302", verdict: "CORRECT" as const, recognizedAnswer: "12", comment: "Верно." };

  assert.deepEqual(toStudentFacingResult(source), source);
});

test("ошибочный вердикт сохраняет разбор ошибки", () => {
  const source = {
    number: "303",
    verdict: "INCORRECT" as const,
    recognizedAnswer: "7",
    comment: "Потерян знак при раскрытии скобок."
  };

  assert.deepEqual(toStudentFacingResult(source), source);
});

test("результаты сортируются по номеру", () => {
  const view = toStudentFacingResults([
    { number: "310", verdict: "CORRECT", recognizedAnswer: null, comment: null },
    { number: "4", verdict: "INCORRECT", recognizedAnswer: null, comment: null },
    { number: "77", verdict: "UNCERTAIN", recognizedAnswer: null, comment: null }
  ]);

  assert.deepEqual(
    view.map((entry) => entry.number),
    ["4", "77", "310"]
  );
});

test("пустой список остаётся пустым", () => {
  assert.deepEqual(toStudentFacingResults([]), []);
});
