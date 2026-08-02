import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportPlan,
  IMPORT_FORMAT_VERSION,
  MAX_IMPORT_NUMBERS,
  parseTopicImport
} from "@/lib/topic-import";
import { TOPIC_IMPORT_PROMPT } from "@/lib/topic-import-prompt";

function payload(overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: IMPORT_FORMAT_VERSION,
    topic: { title: "Логарифмы", description: "Простейшие логарифмические уравнения." },
    numbers: [{ number: 1, conditionLatex: "Решите $\\log_2 x = 3$.", answerLatex: "$x=8$" }],
    warnings: [],
    ...overrides
  };
}

test("parseTopicImport разбирает минимальный валидный файл", () => {
  const result = parseTopicImport(payload());

  assert.equal(result.ok, true);
  assert.ok(result.ok);
  assert.equal(result.data.title, "Логарифмы");
  assert.equal(result.data.numbers.length, 1);
  assert.equal(result.data.numbers[0].answerLatex, "$x=8$");
  assert.deepEqual(result.data.issues, []);
});

test("parseTopicImport отвергает чужую версию формата", () => {
  const result = parseTopicImport(payload({ formatVersion: 2 }));

  assert.equal(result.ok, false);
  assert.ok(!result.ok);
  assert.match(result.error, /formatVersion/);
});

test("parseTopicImport отвергает не-объект", () => {
  assert.equal(parseTopicImport(null).ok, false);
  assert.equal(parseTopicImport([]).ok, false);
  assert.equal(parseTopicImport("{}").ok, false);
});

test("parseTopicImport требует название темы", () => {
  const result = parseTopicImport(payload({ topic: { title: "   ", description: "текст" } }));

  assert.equal(result.ok, false);
});

test("parseTopicImport не требует описание: оно нужно только новой теме", () => {
  const result = parseTopicImport(payload({ topic: { title: "Логарифмы" } }));

  assert.ok(result.ok);
  assert.equal(result.data.description, "");
});

test("parseTopicImport берёт первый из дублирующихся номеров и пишет issue", () => {
  const result = parseTopicImport(
    payload({
      numbers: [
        { number: 5, conditionLatex: "первое", answerLatex: null },
        { number: 5, conditionLatex: "второе", answerLatex: null }
      ]
    })
  );

  assert.ok(result.ok);
  assert.equal(result.data.numbers.length, 1);
  assert.equal(result.data.numbers[0].conditionLatex, "первое");
  assert.equal(result.data.issues.length, 1);
  assert.match(result.data.issues[0], /встречается несколько раз/);
});

test("parseTopicImport выбрасывает записи с пустым условием и неверным номером", () => {
  const result = parseTopicImport(
    payload({
      numbers: [
        { number: 1, conditionLatex: "  ", answerLatex: null },
        { number: 0, conditionLatex: "условие", answerLatex: null },
        { number: "abc", conditionLatex: "условие", answerLatex: null },
        { number: 3, conditionLatex: "живое условие", answerLatex: null }
      ]
    })
  );

  assert.ok(result.ok);
  assert.equal(result.data.numbers.length, 1);
  assert.equal(result.data.numbers[0].number, 3);
  assert.equal(result.data.issues.length, 3);
});

test("parseTopicImport превращает пустой ответ в null", () => {
  const result = parseTopicImport(
    payload({ numbers: [{ number: 1, conditionLatex: "условие", answerLatex: "   " }] })
  );

  assert.ok(result.ok);
  assert.equal(result.data.numbers[0].answerLatex, null);
});

test("parseTopicImport сортирует номера по возрастанию", () => {
  const result = parseTopicImport(
    payload({
      numbers: [
        { number: 12, conditionLatex: "в", answerLatex: null },
        { number: 2, conditionLatex: "а", answerLatex: null },
        { number: 7, conditionLatex: "б", answerLatex: null }
      ]
    })
  );

  assert.ok(result.ok);
  assert.deepEqual(
    result.data.numbers.map((item) => item.number),
    [2, 7, 12]
  );
});

test("parseTopicImport обрезает файл по лимиту задач", () => {
  const numbers = Array.from({ length: MAX_IMPORT_NUMBERS + 5 }, (_, index) => ({
    number: index + 1,
    conditionLatex: `условие ${index + 1}`,
    answerLatex: null
  }));

  const result = parseTopicImport(payload({ numbers }));

  assert.ok(result.ok);
  assert.equal(result.data.numbers.length, MAX_IMPORT_NUMBERS);
  assert.match(result.data.issues.join(" "), /не больше/);
});

test("parseTopicImport падает, если ни одной задачи разобрать не удалось", () => {
  const result = parseTopicImport(payload({ numbers: [{ number: 1, conditionLatex: "" }] }));

  assert.equal(result.ok, false);
});

test("buildImportPlan делит номера на создание, заполнение и перезапись", () => {
  const parsed = [
    { number: 1, conditionLatex: "новое условие", answerLatex: "$1$" },
    { number: 2, conditionLatex: "условие 2", answerLatex: "$2$" },
    { number: 3, conditionLatex: "другое условие", answerLatex: null },
    { number: 4, conditionLatex: "условие 4", answerLatex: "$4$" }
  ];

  const existing = [
    { number: 2, conditionLatex: null, answerLatex: null },
    { number: 3, conditionLatex: "старое условие", answerLatex: null },
    { number: 4, conditionLatex: "условие 4", answerLatex: "$4$" }
  ];

  const plan = buildImportPlan(parsed, existing);

  assert.deepEqual(
    plan.toCreate.map((item) => item.number),
    [1]
  );
  assert.deepEqual(
    plan.toFill.map((item) => item.number),
    [2]
  );
  assert.deepEqual(
    plan.toOverwrite.map((item) => item.number),
    [3]
  );
  assert.equal(plan.untouched, 1);
});

test("TOPIC_IMPORT_PROMPT не потерял обратные слэши при экранировании", () => {
  // Если в шаблонной строке забыть удвоить слэш, \text превратится в табуляцию.
  assert.ok(TOPIC_IMPORT_PROMPT.includes("\\text{"));
  assert.ok(TOPIC_IMPORT_PROMPT.includes("\\\\log_2"));
  assert.ok(TOPIC_IMPORT_PROMPT.includes("formatVersion"));
  assert.equal(TOPIC_IMPORT_PROMPT.includes("\t"), false);
});
