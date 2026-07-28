import test from "node:test";
import assert from "node:assert/strict";
import { splitLineIntoItems } from "../lib/latex-line-items";

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
