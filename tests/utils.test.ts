import test from "node:test";
import assert from "node:assert/strict";
import {
  completionPercent,
  formatDate,
  getFileExtension,
  getMimeTypeFromExtension,
  parseNumbersInput,
  sanitizeFileName,
  toIsoDateTimeString
} from "../lib/utils";

test("parseNumbersInput expands ranges, deduplicates values, and sorts result", () => {
  assert.deepEqual(parseNumbersInput("5, 2, 2, 4-6, 3"), [2, 3, 4, 5, 6]);
});

test("parseNumbersInput supports reversed ranges and unicode dashes", () => {
  assert.deepEqual(parseNumbersInput("10–8, 3—4"), [3, 4, 8, 9, 10]);
});

test("parseNumbersInput ignores invalid and non-positive values", () => {
  assert.deepEqual(parseNumbersInput("0, -1, hello, 7, 2-2"), [2, 7]);
});

test("formatDate and toIsoDateTimeString handle empty values safely", () => {
  assert.equal(formatDate(null), "Без даты");
  assert.equal(toIsoDateTimeString(null), null);
  assert.equal(toIsoDateTimeString("not-a-date"), null);
});

test("formatDate renders Russian date output for a stable daytime timestamp", () => {
  const date = new Date(Date.UTC(2026, 3, 8, 12, 0, 0));
  assert.equal(formatDate(date), "08 апреля 2026 г.");
});

test("completionPercent returns rounded percentages and handles zero totals", () => {
  assert.equal(completionPercent(0, 0), 0);
  assert.equal(completionPercent(1, 3), 33);
  assert.equal(completionPercent(2, 3), 67);
});

test("getFileExtension strips query strings and normalizes case", () => {
  assert.equal(getFileExtension("Homework.PDF?version=2#hash"), ".pdf");
  assert.equal(getFileExtension("archive"), "");
});

test("getMimeTypeFromExtension maps supported file types and falls back safely", () => {
  assert.equal(getMimeTypeFromExtension(".pdf"), "application/pdf");
  assert.equal(
    getMimeTypeFromExtension(".docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  assert.equal(getMimeTypeFromExtension(".unknown"), "application/octet-stream");
});

test("sanitizeFileName normalizes spaces and removes unsafe characters", () => {
  assert.equal(sanitizeFileName("  Алгебра / ДЗ №1 .pdf "), "Алгебра-ДЗ-No1-.pdf");
  assert.equal(sanitizeFileName("weird***name?.png"), "weird-name-.png");
});
