export type CheckVerdict = "CORRECT" | "INCORRECT" | "UNCERTAIN";

export type ParsedCheckResult = {
  number: number;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
  confidence: number | null;
  copySuspected: boolean;
  copyReason: string | null;
};

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

export function parseCheckResponse(content: string, validNumbers: number[]): ParsedCheckResult[] {
  const payload = extractJsonObject(content) as { results?: unknown } | null;

  if (!payload || !Array.isArray(payload.results)) {
    throw new Error("Модель вернула JSON без массива results.");
  }

  const validSet = new Set(validNumbers);
  const seenNumbers = new Set<number>();
  const parsed: ParsedCheckResult[] = [];

  for (const entry of payload.results) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const raw = entry as Record<string, unknown>;
    const number = Number(raw.number);
    const verdict = verdictAliases[String(raw.verdict ?? "").trim().toUpperCase()];

    if (!Number.isInteger(number) || !validSet.has(number) || seenNumbers.has(number) || !verdict) {
      continue;
    }

    seenNumbers.add(number);

    const confidenceRaw = Number(raw.confidence);
    const recognizedAnswer =
      typeof raw.recognized_answer === "string" && raw.recognized_answer.trim()
        ? raw.recognized_answer.trim().slice(0, 500)
        : null;
    const comment =
      typeof raw.comment === "string" && raw.comment.trim() ? raw.comment.trim().slice(0, 1000) : null;

    const copyReason =
      typeof raw.copy_reason === "string" && raw.copy_reason.trim() ? raw.copy_reason.trim().slice(0, 500) : null;

    parsed.push({
      number,
      verdict,
      recognizedAnswer,
      comment,
      confidence: Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : null,
      copySuspected: raw.copy_suspected === true,
      copyReason
    });
  }

  return parsed;
}
