import { HomeworkNumberStatus, LessonItemResult } from "@prisma/client";
import { getStatusForAiVerdict, isStatusDowngrade } from "@/lib/solution-check-status";
import type { CheckVerdict } from "@/lib/solution-check-parse";

export const PROGRESS_SOURCE_LABELS = {
  teacher: "Отметка учителя",
  homework_check: "Проверка ДЗ",
  lesson_teacher: "Итог урока от учителя",
  lesson_check: "Проверка на уроке",
  lesson_end: "Завершение урока"
} as const;

export const PROGRESS_DECISION_LABELS = {
  changed: "Статус изменён",
  reaffirmed: "Отметка подтверждена повторно",
  unchanged: "Статус уже совпадает",
  uncertain: "Проверка не дала определённого результата",
  downgrade_blocked: "Проверка ДЗ не понижает достигнутый статус",
  newer_status: "Сохранена отметка, сделанная после запуска проверки",
  no_status: "Этот итог не меняет общий прогресс",
  lesson_result_preserved: "Сохранён ранее выставленный итог урока"
} as const;

export type ProgressDecisionReason = keyof typeof PROGRESS_DECISION_LABELS;
export type ProgressSource = keyof typeof PROGRESS_SOURCE_LABELS;

export type ProgressIntent =
  | { source: "teacher"; status: HomeworkNumberStatus | null }
  | { source: "homework_check"; verdict: CheckVerdict; checkStartedAt: Date }
  | { source: "lesson_teacher"; result: LessonItemResult | null; previousResult: LessonItemResult | null }
  | { source: "lesson_check"; result: LessonItemResult | null; verdict: CheckVerdict }
  | { source: "lesson_end"; result: LessonItemResult };

const RESULT_TO_STATUS: Partial<Record<LessonItemResult, HomeworkNumberStatus>> = {
  SOLVED: HomeworkNumberStatus.GREEN,
  PARTIAL: HomeworkNumberStatus.YELLOW,
  NOT_SOLVED: HomeworkNumberStatus.RED
};

export type ProgressDecision = {
  write: boolean;
  requestedStatus: HomeworkNumberStatus | null;
  status: HomeworkNumberStatus | null;
  reason: ProgressDecisionReason;
};

/** Единые правила записи. Различия ДЗ и урока намеренно сохранены. */
export function decideProgressChange(
  current: { status: HomeworkNumberStatus | null; statusChangedAt: Date | null } | null,
  intent: ProgressIntent
): ProgressDecision {
  const previous = current?.status ?? null;
  const keep = (reason: ProgressDecisionReason, requestedStatus: HomeworkNumberStatus | null = null): ProgressDecision =>
    ({ write: false, requestedStatus, status: previous, reason });
  let requested: HomeworkNumberStatus | null;

  if (intent.source === "homework_check") {
    requested = getStatusForAiVerdict(intent.verdict, previous);
    if (requested === null) return keep("uncertain");
    if (requested === previous) return keep("unchanged", requested);
    if (isStatusDowngrade(requested, previous)) return keep("downgrade_blocked", requested);
    if (current?.statusChangedAt && current.statusChangedAt > intent.checkStartedAt) {
      return keep("newer_status", requested);
    }
  } else if (intent.source === "teacher") {
    requested = intent.status;
  } else {
    if (intent.source === "lesson_check" && intent.result === null) {
      return keep(intent.verdict === "UNCERTAIN" ? "uncertain" : "lesson_result_preserved");
    }
    if (intent.result === LessonItemResult.SKIPPED) return keep("no_status");
    if (intent.result === null) {
      if (intent.source !== "lesson_teacher" || intent.previousResult === null || intent.previousResult === LessonItemResult.SKIPPED) {
        return keep("no_status");
      }
      requested = null;
    } else {
      requested = RESULT_TO_STATUS[intent.result] ?? null;
    }
  }

  // Ручная повторная отметка остаётся новым действием: её время защищает
  // от ответа ранее запущенной проверки ДЗ, даже если цвет не изменился.
  return { write: true, requestedStatus: requested, status: requested, reason: previous === requested ? "reaffirmed" : "changed" };
}

export function progressStatusLabel(status: HomeworkNumberStatus | null) {
  return status === "GREEN" ? "Решил" : status === "YELLOW" ? "Решил с ошибками" : status === "RED" ? "Не решил" : "Без отметки";
}
