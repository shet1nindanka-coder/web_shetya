import type { CheckVerdict } from "@/lib/solution-check-parse";

/**
 * Что из результата автопроверки видит ученик.
 *
 * Вердикт с низкой уверенностью закрывается в UNCERTAIN уже при разборе ответа
 * (`normalizeCheckResultsByConfidence`), но комментарий модели при этом остаётся
 * прежним — и ученик видел плашку «не распознано» рядом с текстом «Верно.»
 * (PROD-011). Комментарий писался под другой вердикт, поэтому как утверждение
 * он больше не годится.
 *
 * Полный результат — с исходным комментарием, `recognizedAnswer`, диагностикой
 * и пометками — остаётся у учителя: здесь режется только то, что уходит ученику.
 */

export const UNCERTAIN_STUDENT_COMMENT =
  "Не удалось уверенно разобрать решение по фото. Покажи его учителю — он проверит вручную.";

export type StudentFacingCheckResult = {
  number: number;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
};

export function toStudentFacingResult(result: {
  number: number;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
}): StudentFacingCheckResult {
  if (result.verdict === "UNCERTAIN") {
    return {
      number: result.number,
      verdict: result.verdict,
      // Распознанный ответ тоже убираем: он был распознан неуверенно, а ученик
      // прочитает его как «вот что ты написал» и будет спорить с учителем.
      recognizedAnswer: null,
      comment: UNCERTAIN_STUDENT_COMMENT
    };
  }

  return {
    number: result.number,
    verdict: result.verdict,
    recognizedAnswer: result.recognizedAnswer,
    comment: result.comment
  };
}

export function toStudentFacingResults(
  results: Array<{
    number: number;
    verdict: CheckVerdict;
    recognizedAnswer: string | null;
    comment: string | null;
  }>
): StudentFacingCheckResult[] {
  return results.map(toStudentFacingResult).sort((left, right) => left.number - right.number);
}
