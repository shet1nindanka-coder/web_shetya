import type { HomeworkNumberStatus } from "@prisma/client";
import { extractJsonObject } from "@/lib/solution-check-parse";

/*
 * Факты и валидация ИИ-подбора заданий на урок.
 * Здесь НЕТ эвристик подбора: никаких множителей скорости, баллов приоритета
 * и расчёта «минут на задачу». Сколько и каких задач дать — решает модель;
 * код лишь собирает доступные номера и валидирует её ответ.
 */

export const MIN_DURATION_MINUTES = 15;
export const MAX_DURATION_MINUTES = 240;
export const MIN_SPEED = 1;
export const MAX_SPEED = 10;
export const MAX_GROUP_SIZE = 30;

// Предохранители, а не подбор: защита от разорительного запроса и от сорвавшейся модели.
export const MAX_SHORTLIST = 60; // сколько кандидатов уходит во второй этап с полными условиями
export const MAX_PLAN_ITEMS = 40; // потолок номеров в плане одного ученика
export const CONDITION_CHARS_LIMIT = 600;

export const MAX_TEACHER_NOTE_LENGTH = 500;
export const MAX_TITLE_LENGTH = 200;
const MAX_COMMENT_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 400;
const MAX_MODEL_MINUTES = 240;

export type PlanReason = "NEW" | "GAP";

const PLAN_REASONS: PlanReason[] = ["NEW", "GAP"];

export type AvailableNumber = {
  id: string;
  number: number;
  topicId: string;
  topicTitle: string;
  topicDisplayOrder: number;
  displayOrder: number;
  difficulty: number | null;
  estimatedMinutes: number | null;
  conditionLatex: string | null;
  status: HomeworkNumberStatus | null;
  note: string | null;
  deadlineAt: Date | null;
  statusChangedAt: Date | null;
  /** Номер уже выдавался в ДЗ, но так и не решён — повторная выдача уместна. */
  assignedBefore: boolean;
  /** Задачу разбирали на уроке, но ученик её не решил (итог NOT_SOLVED) — вернуть уместно. */
  attemptedInLesson: boolean;
};

export type LessonPlanContextTopics = {
  topics: Array<{
    id: string;
    title: string;
    displayOrder: number;
    numbers: Array<{
      id: string;
      number: number;
      displayOrder: number;
      difficulty: number | null;
      estimatedMinutes: number | null;
      conditionLatex: string | null;
      status: HomeworkNumberStatus | null;
      note: string | null;
      deadlineAt: Date | null;
      statusChangedAt: Date | null;
      assignedBefore: boolean;
      attemptedInLesson: boolean;
    }>;
  }>;
  excludedNumberIds: string[];
};

export type PlanParams = {
  title: string;
  durationMinutes: number;
  topicIds: string[];
  targetDifficulty: number | null;
  teacherNote: string;
};

export type ParsedPlanItem = {
  index: number;
  reason: PlanReason;
  minutes: number | null;
  comment: string;
};

export type ParsedPlan = {
  items: ParsedPlanItem[]; // основная часть — на всю длительность занятия
  extraItems: ParsedPlanItem[]; // дополнительная — если основная решена раньше времени
  summary: string;
};

export function toFiniteInteger(value: unknown): number | null {
  // Number(null) === 0 и Number("") === 0 — считаем это отсутствием значения.
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Только фактические исключения, без ранжирования: уже выданное на уроках,
 * активные ДЗ, прорешанные (GREEN/YELLOW) номера и темы вне фильтра. Порядок
 * нейтральный и стабильный — для воспроизводимости, а не для приоритета.
 */
export function collectAvailableNumbers(
  context: LessonPlanContextTopics,
  params: { topicIds?: string[] }
): AvailableNumber[] {
  const excluded = new Set(context.excludedNumberIds);
  const topicFilter = params.topicIds && params.topicIds.length > 0 ? new Set(params.topicIds) : null;

  const available: AvailableNumber[] = [];

  for (const topic of context.topics) {
    if (topicFilter && !topicFilter.has(topic.id)) {
      continue;
    }

    for (const number of topic.numbers) {
      if (excluded.has(number.id)) {
        continue;
      }

      available.push({
        id: number.id,
        number: number.number,
        topicId: topic.id,
        topicTitle: topic.title,
        topicDisplayOrder: topic.displayOrder,
        displayOrder: number.displayOrder,
        difficulty: number.difficulty,
        estimatedMinutes: number.estimatedMinutes,
        conditionLatex: number.conditionLatex,
        status: number.status,
        note: number.note,
        deadlineAt: number.deadlineAt,
        statusChangedAt: number.statusChangedAt,
        assignedBefore: number.assignedBefore,
        attemptedInLesson: number.attemptedInLesson
      });
    }
  }

  available.sort(
    (a, b) =>
      a.topicDisplayOrder - b.topicDisplayOrder || a.displayOrder - b.displayOrder || a.number - b.number
  );

  return available;
}

/** Разбор первого этапа (отсев): {"indexes":[0,4,7]} → валидные уникальные индексы. */
export function parseShortlistResponse(content: string, candidateCount: number): number[] {
  let payload: { indexes?: unknown };

  try {
    payload = extractJsonObject(content) as { indexes?: unknown };
  } catch {
    return [];
  }

  if (!payload || !Array.isArray(payload.indexes)) {
    return [];
  }

  const seen = new Set<number>();
  const indexes: number[] = [];

  for (const raw of payload.indexes) {
    const index = toFiniteInteger(raw);

    if (index === null || index < 0 || index >= candidateCount || seen.has(index)) {
      continue;
    }

    seen.add(index);
    indexes.push(index);

    if (indexes.length >= MAX_SHORTLIST) {
      break;
    }
  }

  return indexes;
}

/** Разбор второго этапа: порядок элементов от модели сохраняется — это порядок решения на уроке. */
export function parseLessonPlanResponse(content: string, candidateCount: number): ParsedPlan {
  const empty: ParsedPlan = { items: [], extraItems: [], summary: "" };
  let payload: { items?: unknown; extraItems?: unknown; summary?: unknown };

  try {
    payload = extractJsonObject(content) as { items?: unknown; extraItems?: unknown; summary?: unknown };
  } catch {
    return empty;
  }

  if (!payload || !Array.isArray(payload.items)) {
    return empty;
  }

  // Общий набор индексов: номер не может быть одновременно в основной и дополнительной части.
  const seen = new Set<number>();

  const collect = (rawList: unknown, limit: number): ParsedPlanItem[] => {
    if (!Array.isArray(rawList)) {
      return [];
    }

    const collected: ParsedPlanItem[] = [];

    for (const raw of rawList) {
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const record = raw as Record<string, unknown>;
      const index = toFiniteInteger(record.index);

      if (index === null || index < 0 || index >= candidateCount || seen.has(index)) {
        continue;
      }

      const reasonRaw = typeof record.reason === "string" ? record.reason.toUpperCase() : "";
      const reason = (PLAN_REASONS as string[]).includes(reasonRaw) ? (reasonRaw as PlanReason) : "NEW";

      const minutesRaw = toFiniteInteger(record.minutes);
      const minutes = minutesRaw === null || minutesRaw < 1 ? null : Math.min(MAX_MODEL_MINUTES, minutesRaw);

      const comment = typeof record.comment === "string" ? record.comment.trim().slice(0, MAX_COMMENT_LENGTH) : "";

      seen.add(index);
      collected.push({ index, reason, minutes, comment });

      if (collected.length >= limit) {
        break;
      }
    }

    return collected;
  };

  const items = collect(payload.items, MAX_PLAN_ITEMS);
  const extraItems = collect(payload.extraItems, MAX_PLAN_ITEMS);
  const summary = typeof payload.summary === "string" ? payload.summary.trim().slice(0, MAX_SUMMARY_LENGTH) : "";

  return { items, extraItems, summary };
}

/** Скорость ученика: целое 1..10 либо null («не указана»). */
export function normalizeSpeed(raw: unknown): number | null {
  const speed = toFiniteInteger(raw);

  if (speed === null) {
    return null;
  }

  return clampInteger(speed, MIN_SPEED, MAX_SPEED);
}

export function normalizePlanParams(raw: {
  title?: unknown;
  durationMinutes?: unknown;
  topicIds?: unknown;
  targetDifficulty?: unknown;
  teacherNote?: unknown;
}): PlanParams {
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, MAX_TITLE_LENGTH) : "";

  const durationRaw = toFiniteInteger(raw.durationMinutes);
  const durationMinutes =
    durationRaw === null ? 60 : clampInteger(durationRaw, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES);

  const topicIds = Array.isArray(raw.topicIds)
    ? raw.topicIds.map((value) => String(value).trim()).filter(Boolean)
    : [];

  const targetRaw = toFiniteInteger(raw.targetDifficulty);
  const targetDifficulty = targetRaw === null ? null : clampInteger(targetRaw, 1, 10);

  const teacherNote =
    typeof raw.teacherNote === "string" ? raw.teacherNote.trim().slice(0, MAX_TEACHER_NOTE_LENGTH) : "";

  return { title, durationMinutes, topicIds, targetDifficulty, teacherNote };
}
