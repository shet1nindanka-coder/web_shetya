import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import {
  cx,
  completionPercent,
  formatDate,
  formatDateTime,
  formatFileSize,
  getFileExtension,
  getMimeTypeFromExtension,
  getStatusCounts,
  isImageMime,
  isOfficeMime,
  isPdfMime,
  normalizeLoginInput,
  normalizeMultilineText,
  normalizeSingleLineText,
  parseNumbersInput,
  roleHome,
  sanitizeFileName,
  toIsoDateTimeString,
  isHomeworkOverdue
} from "../lib/utils";

test("cx joins only truthy class name fragments", () => {
  assert.equal(cx("base", false, undefined, "active", null, "compact"), "base active compact");
});

test("roleHome routes users to the correct dashboard root", () => {
  assert.equal(roleHome(UserRole.TEACHER), "/teacher");
  assert.equal(roleHome(UserRole.STUDENT), "/student");
  assert.equal(roleHome(UserRole.DEVELOPER), "/teacher/topics");
});

test("normalizeSingleLineText trims, collapses whitespace, and strips control chars", () => {
  assert.equal(normalizeSingleLineText(" \u0000  Мария \n\t Смирнова  "), "Мария Смирнова");
});

test("normalizeMultilineText keeps lines, trims trailing spaces, and removes control chars", () => {
  assert.equal(
    normalizeMultilineText("  Первая строка  \r\nВторая\tстрока\u0007  \r\n\r\n "),
    "Первая строка\nВторая\tстрока"
  );
});

test("normalizeLoginInput normalizes login casing and whitespace", () => {
  assert.equal(normalizeLoginInput("  Maria@Example.COM \n"), "maria@example.com");
});

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

test("formatDateTime renders Russian date and time output", () => {
  const date = new Date("2026-04-08T12:05:00");
  assert.equal(formatDateTime(date), "08.04.2026, 12:05");
});

test("formatFileSize formats bytes, KB, and MB", () => {
  assert.equal(formatFileSize(512), "512 Б");
  assert.equal(formatFileSize(1536), "1.5 КБ");
  assert.equal(formatFileSize(3 * 1024 * 1024), "3.0 МБ");
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

test("mime helpers recognize supported preview types", () => {
  assert.equal(isPdfMime("application/pdf"), true);
  assert.equal(isPdfMime("image/png"), false);
  assert.equal(isImageMime("image/png"), true);
  assert.equal(isImageMime("application/pdf"), false);
  assert.equal(isOfficeMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), true);
  assert.equal(isOfficeMime("image/jpeg"), false);
});

test("getStatusCounts counts only non-null statuses", () => {
  assert.deepEqual(
    getStatusCounts([
      HomeworkNumberStatus.GREEN,
      HomeworkNumberStatus.YELLOW,
      HomeworkNumberStatus.RED,
      HomeworkNumberStatus.GREEN,
      null,
      undefined
    ]),
    {
      GREEN: 2,
      YELLOW: 1,
      RED: 1
    }
  );
});

test("isHomeworkOverdue detects passed deadlines for incomplete homework only", () => {
  const now = new Date("2026-07-08T12:00:00.000Z").getTime();

  assert.equal(isHomeworkOverdue("2026-07-01T00:00:00.000Z", false, now), true);
  assert.equal(isHomeworkOverdue("2026-07-01T00:00:00.000Z", true, now), false);
  assert.equal(isHomeworkOverdue("2026-08-01T00:00:00.000Z", false, now), false);
  assert.equal(isHomeworkOverdue(null, false, now), false);
  assert.equal(isHomeworkOverdue("not-a-date", false, now), false);
});
