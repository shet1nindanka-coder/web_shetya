import test from "node:test";
import assert from "node:assert/strict";
import { mergeSoftWrappedLines, splitLineIntoItems, splitMathIntoItems } from "../lib/latex-line-items";

test("splits uppercase and digit labels with a bracket", () => {
  const result = splitLineIntoItems("А) первый пункт Б) второй 10) десятый");

  assert.equal(result.labeled, true);
  assert.deepEqual(result.items, ["А) первый пункт", "Б) второй", "10) десятый"]);
});

test("supports lowercase labels in both alphabets and both separators", () => {
  const cyrillic = splitLineIntoItems("а) один б) два");
  const latin = splitLineIntoItems("a) one b) two");
  const dots = splitLineIntoItems("а. один б. два");

  assert.deepEqual(cyrillic.items, ["а) один", "б) два"]);
  assert.deepEqual(latin.items, ["a) one", "b) two"]);
  assert.deepEqual(dots.items, ["а. один", "б. два"]);
});

test("a single labeled item is still marked as labeled", () => {
  const result = splitLineIntoItems("а) единственный пункт с длинным текстом");

  assert.equal(result.labeled, true);
  assert.deepEqual(result.items, ["а) единственный пункт с длинным текстом"]);
});

test("a decimal number is not a label", () => {
  const result = splitLineIntoItems("Вычислите 1.5 плюс 2.25");

  assert.equal(result.labeled, false);
  assert.deepEqual(result.items, ["Вычислите 1.5 плюс 2.25"]);
});

test("labels inside math are ignored", () => {
  const result = splitLineIntoItems("Решите $f(a) = b)$ без пунктов");

  assert.equal(result.labeled, false);
});

test("text before the first label becomes its own item", () => {
  const result = splitLineIntoItems("Решите уравнения: а) $x^2=4$ б) $x^3=8$");

  assert.deepEqual(result.items, ["Решите уравнения:", "а) $x^2=4$", "б) $x^3=8$"]);
});

test("plain text without labels is returned as-is", () => {
  const result = splitLineIntoItems("Просто длинное условие без пунктов");

  assert.equal(result.labeled, false);
  assert.deepEqual(result.items, ["Просто длинное условие без пунктов"]);
});

test("splitMathIntoItems splits display math by top-level labels", () => {
  const math =
    "\\text{А)} \\begin{cases} x+y=-1 \\\\ x-y=1 \\end{cases} Б) \\begin{cases} 5x+y-7=0 \\\\ x-3y-11=0 \\end{cases}";
  const result = splitMathIntoItems(math);

  assert.equal(result.labeled, true);
  assert.equal(result.items.length, 2);
  assert.ok(result.items[1].startsWith("Б)"));
});

test("splitMathIntoItems treats top-level \\text{А)} as a label too", () => {
  const math = "\\text{А)} \\begin{cases} x=1 \\end{cases} \\text{Б)} \\begin{cases} y=2 \\end{cases}";
  const result = splitMathIntoItems(math);

  assert.equal(result.labeled, true);
  assert.equal(result.items.length, 2);
  assert.ok(result.items[0].startsWith("\\text{А)}"));
  assert.ok(result.items[1].startsWith("\\text{Б)}"));
});

test("splitMathIntoItems ignores labels inside cases environments and groups", () => {
  const insideEnv = splitMathIntoItems("\\begin{cases} a) x \\\\ b) y \\end{cases}");
  const insideGroup = splitMathIntoItems("\\text{решите: а) и б)}");

  assert.equal(insideEnv.labeled, false);
  assert.equal(insideGroup.labeled, false);
});

test("splitMathIntoItems keeps a plain formula untouched", () => {
  const result = splitMathIntoItems("x^2 + y^2 = r^2");

  assert.equal(result.labeled, false);
  assert.deepEqual(result.items, ["x^2 + y^2 = r^2"]);
});

test("a mid-line dot number in prose is not a label", () => {
  const result = splitLineIntoItems("сумму разделить на 2, то получится 10. Какое число задумал ученик?");

  assert.equal(result.labeled, false);
});

test("abbreviations like «и т. д.» are not labels", () => {
  const result = splitLineIntoItems("Продолжите ряд 2, 4, 8 и т. д. до десятого члена");

  assert.equal(result.labeled, false);
});

test("dot labels still split when the line starts with one", () => {
  const result = splitLineIntoItems("1. первый пункт 2. второй пункт");

  assert.equal(result.labeled, true);
  assert.deepEqual(result.items, ["1. первый пункт", "2. второй пункт"]);
});

test("mergeSoftWrappedLines joins a sentence wrapped mid-phrase", () => {
  const merged = mergeSoftWrappedLines(
    "Ученик задумал число. Если его умножить на 4, к произведению прибавить 8 и полученную\nсумму разделить на 2, то получится\n10. Какое число задумал ученик?",
  );

  assert.equal(
    merged,
    "Ученик задумал число. Если его умножить на 4, к произведению прибавить 8 и полученную сумму разделить на 2, то получится 10. Какое число задумал ученик?",
  );
});

test("mergeSoftWrappedLines joins even across a blank line inside a phrase", () => {
  const merged = mergeSoftWrappedLines("к произведению прибавить 8 и полученную\n\nсумму разделить на 2");

  assert.equal(merged, "к произведению прибавить 8 и полученную сумму разделить на 2");
});

test("mergeSoftWrappedLines keeps breaks after finished sentences and headings", () => {
  const source = "Сократите дробь:\n$\\dfrac{x^2-4}{x+2}$";

  assert.equal(mergeSoftWrappedLines(source), source);

  const paragraphs = "Первое предложение.\n\nВторое предложение.";

  assert.equal(mergeSoftWrappedLines(paragraphs), paragraphs);
});

test("mergeSoftWrappedLines leaves display math and its boundaries intact", () => {
  const source = "Вычислите\n$$\\int_0^1\nx^2\\,dx$$\nи запишите ответ";

  assert.equal(mergeSoftWrappedLines(source), source);
});
