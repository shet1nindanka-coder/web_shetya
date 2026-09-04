// Периоды отчётов (PDF ученика, PDF посещаемости группы): 7 дней, 30 дней,
// учебный год. Чистая логика, покрыта тестами.

export type ReportPeriod = "7d" | "30d" | "year";

export const REPORT_PERIOD_META: Record<ReportPeriod, { title: string; fileLabel: string }> = {
  "7d": { title: "7 ДНЕЙ", fileLabel: "Неделя" },
  "30d": { title: "30 ДНЕЙ", fileLabel: "30 дней" },
  year: { title: "УЧЕБНЫЙ ГОД", fileLabel: "Учебный год" }
};

/** Начало учебного года: 1 сентября текущего года, а до сентября — прошлого. */
export function academicYearStart(now: Date) {
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  return new Date(year, 8, 1);
}

export function parseReportPeriod(raw: string | null | undefined): ReportPeriod {
  return raw === "30d" || raw === "year" ? raw : "7d";
}

/** Начало периода относительно «сейчас». */
export function reportPeriodStart(period: ReportPeriod, now: Date) {
  if (period === "year") {
    return academicYearStart(now);
  }

  return new Date(now.getTime() - (period === "30d" ? 30 : 7) * 24 * 60 * 60 * 1000);
}
