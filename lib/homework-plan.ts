import { MAX_TEACHER_NOTE_LENGTH, MAX_TITLE_LENGTH } from "@/lib/lesson-plan";

/*
 * Факты и валидация ИИ-подбора домашнего задания. Парсеры и сбор кандидатов
 * переиспользуются из lib/lesson-plan.ts — здесь только специфика ДЗ:
 * одна тема, объём задаётся сроком (дата следующего занятия = дедлайн).
 */

export const MIN_HOMEWORK_DAYS = 1;
export const MAX_HOMEWORK_DAYS = 60;

export type HomeworkPlanParams = {
  title: string;
  topicId: string; // ровно одна тема, обязательна
  deadlineAt: Date; // дата следующего занятия
  teacherNote: string;
  sourceLessonId: string | null;
};

/** Целое число дней до дедлайна, минимум 1, максимум MAX_HOMEWORK_DAYS. */
export function daysUntil(deadlineAt: Date, now: Date): number {
  const days = Math.ceil((deadlineAt.getTime() - now.getTime()) / 86_400_000);

  return Math.min(MAX_HOMEWORK_DAYS, Math.max(MIN_HOMEWORK_DAYS, days));
}

export function normalizeHomeworkParams(raw: unknown, now: Date): HomeworkPlanParams | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const topicId = typeof record.topicId === "string" ? record.topicId.trim() : "";

  if (!topicId) {
    return null;
  }

  const deadlineRaw = record.deadlineAt;
  const deadlineAt =
    typeof deadlineRaw === "string" || deadlineRaw instanceof Date ? new Date(deadlineRaw as string | Date) : null;

  if (!deadlineAt || Number.isNaN(deadlineAt.getTime()) || deadlineAt.getTime() <= now.getTime()) {
    return null;
  }

  const title = typeof record.title === "string" ? record.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  const teacherNote =
    typeof record.teacherNote === "string" ? record.teacherNote.trim().slice(0, MAX_TEACHER_NOTE_LENGTH) : "";
  const sourceLessonId =
    typeof record.sourceLessonId === "string" && record.sourceLessonId.trim() ? record.sourceLessonId.trim() : null;

  return { title, topicId, deadlineAt, teacherNote, sourceLessonId };
}

/** Доминирующая тема занятия: большинство номеров; при равенстве — первая по порядку появления. */
export function pickDominantTopicId(items: Array<{ topicId: string }>): string | null {
  if (items.length === 0) {
    return null;
  }

  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;

  // Map сохраняет порядок вставки — тай-брейк детерминированный: первая встреченная тема.
  for (const [topicId, count] of counts) {
    if (count > bestCount) {
      best = topicId;
      bestCount = count;
    }
  }

  return best;
}
