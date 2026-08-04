import { normalizeHomeworkNumber } from "@/lib/utils";

export type CheckVerdict = "CORRECT" | "INCORRECT" | "UNCERTAIN";

// Единственный источник правды по типам ошибок: на него ссылаются промпт автопроверки
// и свёртка errorProfile в lib/platform-data.ts.
export const ERROR_KINDS = [
  "METHOD", "FORMULA", "DOMAIN", "LOST_ROOT", "ALGEBRA", "BRACKETS",
  "SIGN", "ARITHMETIC", "TRANSCRIPTION", "INCOMPLETE",
  "UNREADABLE", "NOT_FOUND", "NONE"
] as const;

export type ErrorKind = (typeof ERROR_KINDS)[number];

/** Концептуальные — приём не понят; технические — понят, страдает аккуратность. */
export const ERROR_KIND_GROUP: Record<ErrorKind, "conceptual" | "technical" | "incomplete" | "none"> = {
  METHOD: "conceptual",
  FORMULA: "conceptual",
  DOMAIN: "conceptual",
  LOST_ROOT: "conceptual",
  ALGEBRA: "technical",
  BRACKETS: "technical",
  SIGN: "technical",
  ARITHMETIC: "technical",
  TRANSCRIPTION: "technical",
  INCOMPLETE: "incomplete",
  UNREADABLE: "none",
  NOT_FOUND: "none",
  NONE: "none"
};

export type ParsedCheckResult = {
  number: string;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
  confidence: number | null;
  copySuspected: boolean;
  copyReason: string | null;
  errorKind: ErrorKind | null;
  errorNote: string | null;
  injectionSuspected: boolean;
  injectionNote: string | null;
};

export function normalizeCheckResultsByConfidence(
  results: ParsedCheckResult[],
  minConfidence: number
): ParsedCheckResult[] {
  return results.map((result) => {
    if (result.verdict === "UNCERTAIN") {
      return result;
    }

    if (
      result.confidence === null ||
      !Number.isFinite(result.confidence) ||
      result.confidence < minConfidence
    ) {
      return { ...result, verdict: "UNCERTAIN" };
    }

    return result;
  });
}

const verdictAliases: Record<string, CheckVerdict> = {
  CORRECT: "CORRECT",
  INCORRECT: "INCORRECT",
  UNCERTAIN: "UNCERTAIN"
};

export function extractJsonObject(content: string): unknown {
  const withoutFences = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = withoutFences.indexOf("{");
  const end = withoutFences.lastIndexOf("}");

  if (start === -1 || end <= start) {
    throw new Error("В ответе модели нет JSON-объекта.");
  }

  return JSON.parse(withoutFences.slice(start, end + 1));
}

export function parseCheckResponse(content: string, validNumbers: string[]): ParsedCheckResult[] {
  const payload = extractJsonObject(content) as { results?: unknown } | null;

  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("Модель вернула JSON без массива results.");
  }

  // Модель может вернуть номер и числом (JSON срезает ведущий ноль: 10203),
  // и строкой («010203») — сопоставляем по нормализованному виду и возвращаем
  // записанный вид номера из задания.
  const validByNormalized = new Map(validNumbers.map((value) => [normalizeHomeworkNumber(value), value]));
  const seenNumbers = new Set<string>();
  const parsed: ParsedCheckResult[] = [];

  for (const entry of payload.results) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const raw = entry as Record<string, unknown>;
    const rawNumber =
      typeof raw.number === "string" || typeof raw.number === "number" ? String(raw.number).trim() : "";
    const normalizedNumber = normalizeHomeworkNumber(rawNumber);
    const number = /^\d+$/.test(normalizedNumber) ? validByNormalized.get(normalizedNumber) : undefined;
    const verdict = verdictAliases[String(raw.verdict ?? "").trim().toUpperCase()];

    if (number === undefined || seenNumbers.has(normalizedNumber) || !verdict) {
      continue;
    }

    seenNumbers.add(normalizedNumber);

    const confidenceRaw = typeof raw.confidence === "number" ? raw.confidence : Number.NaN;
    const recognizedAnswer =
      typeof raw.recognized_answer === "string" && raw.recognized_answer.trim()
        ? raw.recognized_answer.trim().slice(0, 500)
        : null;
    const comment =
      typeof raw.comment === "string" && raw.comment.trim() ? raw.comment.trim().slice(0, 1000) : null;

    const copyReason =
      typeof raw.copy_reason === "string" && raw.copy_reason.trim() ? raw.copy_reason.trim().slice(0, 500) : null;

    // Диагностика: неизвестный тип ошибки не роняет разбор — просто null.
    const errorKindRaw = String(raw.error_kind ?? "").trim().toUpperCase();
    const errorKind = (ERROR_KINDS as readonly string[]).includes(errorKindRaw) ? (errorKindRaw as ErrorKind) : null;
    const errorNote =
      typeof raw.error_note === "string" && raw.error_note.trim() ? raw.error_note.trim().slice(0, 500) : null;
    const injectionNote =
      typeof raw.injection_note === "string" && raw.injection_note.trim()
        ? raw.injection_note.trim().slice(0, 500)
        : null;

    parsed.push({
      number,
      verdict,
      recognizedAnswer,
      comment,
      confidence: Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : null,
      copySuspected: raw.copy_suspected === true,
      copyReason,
      errorKind,
      errorNote,
      injectionSuspected: raw.injection_suspected === true,
      injectionNote
    });
  }

  return parsed;
}
