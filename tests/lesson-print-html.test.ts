import test from "node:test";
import assert from "node:assert/strict";
import {
  renderConditionGridHtml,
  renderLessonAnswersHtml,
  escapeHtml,
  renderConditionHtml,
  renderLessonPrintHtml,
  splitConditionSegments
} from "../lib/lesson-print-html";

test("escapeHtml neutralizes markup from user input", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("renderConditionHtml escapes text around formulas — script never becomes a tag", () => {
  const html = renderConditionHtml('Решите <script>alert(1)</script> уравнение $x^2=4$');

  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("splitConditionSegments handles inline and display math", () => {
  const segments = splitConditionSegments("Текст $a+b$ ещё $$c^2$$ и \\[d_1\\] конец");

  assert.deepEqual(
    segments.map((segment) => segment.type),
    ["text", "inline", "text", "display", "text", "display", "text"]
  );
  assert.equal(segments[1].value, "a+b");
  assert.equal(segments[3].value, "c^2");
  assert.equal(segments[5].value, "d_1");
});

test("broken formula does not crash the render", () => {
  const html = renderConditionHtml("Плохое: $\\frac{1$");

  assert.equal(typeof html, "string");
  assert.ok(html.length > 0);
});

test("renderLessonPrintHtml gives each student a section with a page break", () => {
  const html = renderLessonPrintHtml({
    title: "Занятие",
    createdAt: new Date("2026-07-28T10:00:00Z"),
    groupName: "Группа",
    participants: [
      { studentName: "Аня", items: [{ number: "1", topicTitle: "Логарифмы", conditionLatex: "$x$" }] },
      { studentName: "Боря", items: [] },
      { studentName: "Вера", items: [] }
    ]
  });

  assert.equal(html.match(/class="student"/g)?.length, 3);
  assert.equal(html.match(/break-before: page/g)?.length, 2);
  assert.ok(html.includes("Аня"));
});

test("number without condition falls back to a homework file reference", () => {
  const html = renderLessonPrintHtml({
    title: "Занятие",
    createdAt: "2026-07-28",
    groupName: null,
    participants: [{ studentName: "Аня", items: [{ number: "14", topicTitle: "Тема «X»", conditionLatex: null }] }]
  });

  assert.ok(html.includes("см. файл ДЗ по теме"));
  assert.ok(html.includes("№ 14"));
});

test("renderConditionGridHtml раскладывает пункты а)–в) по сетке, надпись — отдельной строкой", () => {
  const html = renderConditionGridHtml("Сократите дробь:\nа) $x$ б) $y$ в) $z$");

  assert.ok(html.includes('class="cond-line"'));
  assert.ok(html.includes("Сократите дробь:"));
  assert.equal(html.match(/class="item-cell"/g)?.length, 3);
});

test("renderConditionGridHtml не режет условия с display-математикой", () => {
  const html = renderConditionGridHtml("Решите:\n$$а) x=1 \\quad б) y=2$$");

  assert.ok(!html.includes('class="items-grid"'));
});

test("renderLessonAnswersHtml печатает только ответы и честно помечает пустые", () => {
  const html = renderLessonAnswersHtml({
    title: "Занятие",
    createdAt: new Date("2026-08-15T10:00:00Z"),
    groupName: null,
    kind: "HOMEWORK",
    participants: [
      {
        studentName: "Аня",
        items: [
          { number: "052001", topicTitle: "Дроби", conditionLatex: "$x$", answerLatex: "$x=7$" },
          { number: "052002", topicTitle: "Дроби", conditionLatex: "$y$", answerLatex: null, isExtra: true }
        ]
      }
    ]
  });

  assert.ok(html.includes("Ответы к ДЗ"));
  assert.ok(html.includes("№ 052001"));
  assert.ok(html.includes("ответ не заполнен"));
  assert.ok(html.includes("доп."));
  // блоков задач с условиями в файле ответов нет (общий CSS не в счёт)
  assert.ok(!html.includes('<div class="task">'));
});
