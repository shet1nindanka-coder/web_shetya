import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTopicNumbersChangePlan,
  describeNumberImpact,
  describeTopicImpact,
  hasStudentWork,
  isRemovalConfirmationValid,
  parseConfirmedNumbers,
  summarizeTopicImpact,
  type TopicNumberFacts
} from "@/lib/topic-numbers-change";

function makeNumber(number: string, overrides: Partial<TopicNumberFacts> = {}): TopicNumberFacts {
  return {
    id: `id-${number}`,
    number,
    studentsWithStatus: 0,
    studentsWithNote: 0,
    studentsWithDeadline: 0,
    activeAssignments: 0,
    checkResults: 0,
    lessonItems: 0,
    hasCondition: false,
    hasAnswer: false,
    hasAnswerFile: false,
    ...overrides
  };
}

test("пустой номер без следов работы не требует подтверждения", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("301"), makeNumber("302")], ["301"]);

  assert.equal(plan.removed.length, 1);
  assert.equal(plan.removed[0]!.number, "302");
  assert.equal(plan.removed[0]!.hasStudentWork, false);
  assert.equal(plan.requiresConfirmation, false);
  assert.equal(plan.requiresAssignedConfirmation, false);
});

test("номер со статусом ученика требует подтверждения", () => {
  const plan = buildTopicNumbersChangePlan(
    [makeNumber("301", { studentsWithStatus: 3 }), makeNumber("302")],
    ["302"]
  );

  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.removed[0]!.hasStudentWork, true);
});

test("номер из активного ДЗ требует отдельного подтверждения", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("301", { activeAssignments: 1 })], []);

  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.requiresAssignedConfirmation, true);
  assert.equal(plan.removed[0]!.isAssigned, true);
});

test("LaTeX-условие и ответ считаются трудом, даже если учеников нет", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("305", { hasCondition: true, hasAnswer: true })], []);

  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.requiresAssignedConfirmation, false);
});

test("добавленные и оставшиеся номера считаются отдельно", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("1"), makeNumber("2"), makeNumber("3")], ["2", "3", "10", "10", "4"]);

  assert.deepEqual(plan.added, ["4", "10"]);
  assert.equal(plan.keptCount, 2);
  assert.deepEqual(
    plan.removed.map((entry) => entry.number),
    ["1"]
  );
});

test("удаляемые номера возвращаются по возрастанию", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("310"), makeNumber("4"), makeNumber("77")], []);

  assert.deepEqual(
    plan.removed.map((entry) => entry.number),
    ["4", "77", "310"]
  );
});

test("подтверждение валидно только если покрывает все опасные номера", () => {
  const plan = buildTopicNumbersChangePlan(
    [makeNumber("301", { studentsWithStatus: 1 }), makeNumber("302", { checkResults: 2 }), makeNumber("303")],
    []
  );

  assert.equal(isRemovalConfirmationValid(plan, ["301", "302"]), true);
  assert.equal(isRemovalConfirmationValid(plan, ["301"]), false);
  assert.equal(isRemovalConfirmationValid(plan, []), false);
  // Лишний номер в подтверждении не мешает: важно, что все опасные названы.
  assert.equal(isRemovalConfirmationValid(plan, ["301", "302", "999"]), true);
});

test("безопасная правка не требует подтверждения вообще", () => {
  const plan = buildTopicNumbersChangePlan([makeNumber("1"), makeNumber("2")], ["1", "2", "3"]);

  assert.equal(plan.requiresConfirmation, false);
  assert.equal(isRemovalConfirmationValid(plan, []), true);
});

test("hasStudentWork реагирует на каждый вид следа по отдельности", () => {
  const flags: Array<Partial<TopicNumberFacts>> = [
    { studentsWithStatus: 1 },
    { studentsWithNote: 1 },
    { studentsWithDeadline: 1 },
    { activeAssignments: 1 },
    { checkResults: 1 },
    { lessonItems: 1 },
    { hasCondition: true },
    { hasAnswer: true },
    { hasAnswerFile: true }
  ];

  for (const overrides of flags) {
    assert.equal(hasStudentWork(makeNumber("1", overrides)), true, JSON.stringify(overrides));
  }

  assert.equal(hasStudentWork(makeNumber("1")), false);
});

test("описание последствий читается по-русски и склоняется", () => {
  assert.equal(
    describeNumberImpact(makeNumber("301", { studentsWithStatus: 1, hasCondition: true, hasAnswer: true })),
    "статус у 1 ученика, условие и ответ"
  );
  assert.equal(
    describeNumberImpact(makeNumber("302", { studentsWithStatus: 3, activeAssignments: 2 })),
    "статус у 3 учеников, входит в 2 активных ДЗ"
  );
  assert.equal(describeNumberImpact(makeNumber("303")), "ничего не потеряется");
});

test("подтверждённые номера разбираются из строки формы", () => {
  assert.deepEqual(parseConfirmedNumbers("301, 302 , 305"), ["301", "302", "305"]);
  assert.deepEqual(parseConfirmedNumbers(""), []);
  assert.deepEqual(parseConfirmedNumbers("301, abc, -5, 0, 7"), ["301", "0", "7"]);
});

test("сводка по теме складывает следы работы всех номеров", () => {
  const summary = summarizeTopicImpact([
    makeNumber("301", { studentsWithStatus: 2, studentsWithNote: 1, hasCondition: true, hasAnswer: true }),
    makeNumber("302", { studentsWithStatus: 1, checkResults: 3, activeAssignments: 1, hasCondition: true }),
    makeNumber("303")
  ]);

  assert.equal(summary.totalNumbers, 3);
  assert.equal(summary.numbersWithWork, 2);
  assert.equal(summary.statusCount, 3);
  assert.equal(summary.noteCount, 1);
  assert.equal(summary.activeAssignments, 1);
  assert.equal(summary.checkResults, 3);
  assert.equal(summary.numbersWithCondition, 2);
  assert.equal(summary.numbersWithAnswer, 1);
});

test("пустая тема даёт пустой список последствий", () => {
  assert.deepEqual(describeTopicImpact(summarizeTopicImpact([makeNumber("1"), makeNumber("2")])), []);
});

test("описание последствий удаления темы перечисляет только непустое", () => {
  const lines = describeTopicImpact(summarizeTopicImpact([makeNumber("1", { studentsWithStatus: 4, checkResults: 2 })]));

  assert.deepEqual(lines, ["4 статуса светофора у учеников", "2 вердикта ИИ-проверок"]);
});
