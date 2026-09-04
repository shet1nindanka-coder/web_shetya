import test from "node:test";
import assert from "node:assert/strict";
import { academicYearStart, parseReportPeriod, reportPeriodStart } from "../lib/report-period";

test("academicYearStart: с сентября — текущий год, до сентября — прошлый", () => {
  assert.equal(academicYearStart(new Date(2026, 8, 4)).getTime(), new Date(2026, 8, 1).getTime());
  assert.equal(academicYearStart(new Date(2026, 3, 10)).getTime(), new Date(2025, 8, 1).getTime());
});

test("parseReportPeriod: неизвестное значение — 7 дней", () => {
  assert.equal(parseReportPeriod("30d"), "30d");
  assert.equal(parseReportPeriod("year"), "year");
  assert.equal(parseReportPeriod("garbage"), "7d");
  assert.equal(parseReportPeriod(null), "7d");
});

test("reportPeriodStart: 7 и 30 дней назад, учебный год — 1 сентября", () => {
  const now = new Date(2026, 9, 15, 12, 0, 0);

  assert.equal(reportPeriodStart("7d", now).getTime(), now.getTime() - 7 * 86_400_000);
  assert.equal(reportPeriodStart("30d", now).getTime(), now.getTime() - 30 * 86_400_000);
  assert.equal(reportPeriodStart("year", now).getTime(), new Date(2026, 8, 1).getTime());
});
