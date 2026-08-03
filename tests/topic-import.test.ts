import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportPlan,
  IMPORT_FORMAT_VERSION,
  MAX_IMPORT_NUMBERS,
  parseImportJson,
  parseTopicImport,
  parseTopicImportText,
  repairJsonBackslashes
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

// --- разбор текста файла: модели почти всегда забывают удвоить слэши ---

/** Кусок реального ответа модели: LaTeX как есть, JSON.parse на нём падает. */
const RAW_UNESCAPED = String.raw`{
  "formatVersion": 1,
  "topic": { "title": "Уравнения", "description": "Тригонометрия." },
  "numbers": [
    { "number": 301001, "conditionLatex": "а) Решите уравнение $\dfrac{1}{2\sin x}-\dfrac{1}{\cos 2x-1}=1$.", "answerLatex": null }
  ],
  "warnings": []
}`;

test("repairJsonBackslashes удваивает одиночные слэши и не трогает уже удвоенные", () => {
  assert.equal(repairJsonBackslashes(String.raw`$\sin x$`), String.raw`$\\sin x$`);
  assert.equal(repairJsonBackslashes(String.raw`$\\sin x$`), String.raw`$\\sin x$`);
});

test("repairJsonBackslashes не ломает экранирование кавычек", () => {
  assert.equal(repairJsonBackslashes('a \\" b'), 'a \\" b');
});

test("parseImportJson чинит неэкранированный LaTeX", () => {
  const result = parseImportJson(RAW_UNESCAPED);

  assert.ok(result.ok);
  const value = result.value as { numbers: Array<{ conditionLatex: string }> };
  assert.match(value.numbers[0].conditionLatex, /\\dfrac/);
});

test("parseImportJson снимает markdown-обёртку", () => {
  const wrapped = "```json\n" + JSON.stringify({ formatVersion: 1 }) + "\n```";

  assert.ok(parseImportJson(wrapped).ok);
});

test("parseImportJson спасает LaTeX, который тихо стал табуляцией", () => {
  // \text — валидный JSON-escape \t, поэтому первый разбор проходит, но с мусором.
  const raw = '{"formatVersion":1,"topic":{"title":"Т","description":"о"},"numbers":[{"number":1,"conditionLatex":"$S_{\\text{полн}}$","answerLatex":null}]}';
  const result = parseImportJson(raw);

  assert.ok(result.ok);
  const value = result.value as { numbers: Array<{ conditionLatex: string }> };
  assert.equal(value.numbers[0].conditionLatex.includes("\t"), false);
  assert.match(value.numbers[0].conditionLatex, /\\text\{/);
});

test("parseImportJson не считает перевод строки поломкой", () => {
  const raw = '{"formatVersion":1,"topic":{"title":"Т","description":"первая\\nвторая"},"numbers":[]}';
  const result = parseImportJson(raw);

  assert.ok(result.ok);
  const value = result.value as { topic: { description: string } };
  assert.equal(value.topic.description, "первая\nвторая");
});

test("parseImportJson отвергает пустой файл и мусор", () => {
  assert.equal(parseImportJson("   ").ok, false);
  assert.equal(parseImportJson("совсем не json").ok, false);
});

test("parseTopicImportText принимает реальный ответ модели с шестизначными номерами", () => {
  const result = parseTopicImportText(RAW_UNESCAPED);

  assert.ok(result.ok);
  assert.equal(result.data.numbers.length, 1);
  assert.equal(result.data.numbers[0].number, 301001);
  assert.match(result.data.numbers[0].conditionLatex, /\\dfrac/);
  assert.deepEqual(result.data.issues, []);
});

test("repairJsonBackslashes не пропускает подряд идущие команды", () => {
  assert.equal(repairJsonBackslashes(String.raw`$x^2\,\sin x$`), String.raw`$x^2\\,\\sin x$`);
  assert.equal(repairJsonBackslashes(String.raw`\{a\}`), String.raw`\\{a\\}`);
});

test("repairJsonBackslashes бережёт перенос строки и чинит команды на n", () => {
  assert.equal(repairJsonBackslashes("первая\\nвторая"), "первая\\nвторая");
  assert.equal(repairJsonBackslashes(String.raw`$a\ne b$`), String.raw`$a\\ne b$`);
  assert.equal(repairJsonBackslashes(String.raw`$\nabla f$`), String.raw`$\\nabla f$`);
});

test("починка битого файла не съедает переносы строк", () => {
  const raw =
    '{"formatVersion":1,"topic":{"title":"Т"},"numbers":[{"number":5,"conditionLatex":"Решите систему:\\nа) $\\sin x=0$\\nб) $\\cos x=1$","answerLatex":null}]}';
  const result = parseTopicImportText(raw);

  assert.ok(result.ok);
  assert.equal(result.data.numbers[0].conditionLatex.split("\n").length, 3);
  assert.match(result.data.numbers[0].conditionLatex, /\\sin/);
});

test("тема без описания импортируется", () => {
  const result = parseTopicImportText(
    '{"formatVersion":1,"topic":{"title":"Уравнения"},"numbers":[{"number":1,"conditionLatex":"условие","answerLatex":null}]}'
  );

  assert.ok(result.ok);
  assert.equal(result.data.description, "");
});
