// Чистая логика живого экрана урока: закрытость номеров, открытие доп. части,
// простой ученика и время, потраченное на номер. Без БД и без React — покрыто
// тестами tests/lesson-live.test.ts.

export const LESSON_SUBMISSION_MAX_PHOTOS = 3;

type LiveItemState = {
  isExtra: boolean;
  /** Итог урока, выставленный учителем или предзаполненный ИИ. */
  result: string | null;
  /** Вердикт последней завершённой ИИ-проверки сдачи. */
  latestVerdict: string | null;
};

/**
 * Номер «закрыт»: по нему есть вердикт CORRECT или учитель поставил итог
 * (кроме «не решил» — такой номер ученик может перерешать прямо на уроке).
 */
export function isLessonItemClosed(item: LiveItemState) {
  if (item.result === "SOLVED" || item.result === "PARTIAL" || item.result === "SKIPPED") {
    return true;
  }

  return item.latestVerdict === "CORRECT";
}

/** Доп. часть открывается, когда закрыт каждый номер основной части. */
export function isExtraPartUnlocked(items: LiveItemState[]) {
  const mainItems = items.filter((item) => !item.isExtra);

  if (mainItems.length === 0) {
    return true;
  }

  return mainItems.every((item) => isLessonItemClosed(item));
}

/** Сдавать можно, пока номер не закрыт «положительно» (перерешать после NOT_SOLVED — можно). */
export function canSubmitLessonItem(item: LiveItemState) {
  return !isLessonItemClosed(item);
}

export type IdleLevel = "ok" | "warn" | "alert";

/**
 * Простой ученика на уроке: сколько минут прошло с последнего действия
 * (вход на вкладку урока, сдача фото). Если действий не было вовсе,
 * якорь — начало урока.
 */
export function computeIdleLevel(
  input: {
    lastActivityAt: number | null;
    lessonStartedAt: number;
    warnMinutes: number;
    alertMinutes: number;
  },
  now: number
): { level: IdleLevel; idleMinutes: number } {
  const anchor = Math.max(input.lastActivityAt ?? 0, input.lessonStartedAt);
  const idleMinutes = Math.max(0, Math.floor((now - anchor) / 60_000));

  if (idleMinutes >= input.alertMinutes) {
    return { level: "alert", idleMinutes };
  }

  if (idleMinutes >= input.warnMinutes) {
    return { level: "warn", idleMinutes };
  }

  return { level: "ok", idleMinutes };
}

/**
 * Минуты, потраченные на номер: от предыдущего события участника (прошлая
 * сдача, вход в урок, старт урока) до момента сдачи. Сдачи должны приходить
 * в хронологическом порядке.
 */
export function computeSpentMinutes(
  submittedAtMs: number[],
  anchors: { lessonStartedAt: number; joinedAt: number | null }
): number[] {
  let previous = Math.max(anchors.lessonStartedAt, anchors.joinedAt ?? 0);
  const result: number[] = [];

  for (const submittedAt of submittedAtMs) {
    result.push(Math.max(0, Math.round((submittedAt - previous) / 60_000)));
    previous = Math.max(previous, submittedAt);
  }

  return result;
}

export type AutoLessonResult = "SOLVED" | "PARTIAL" | "NOT_SOLVED";

/**
 * Автоитог по вердикту ИИ-проверки сдачи (правила владельца):
 * - верно с первой попытки → SOLVED («решил»);
 * - верно после ошибочных попыток → PARTIAL («с ошибками»);
 * - неверно → NOT_SOLVED («не решил»);
 * - не распознано → итог не трогаем, решает учитель.
 * Уже закрытый положительно номер (SOLVED/PARTIAL/SKIPPED) не переписываем —
 * это либо ручная отметка учителя, либо более ранний зачёт.
 */
export function decideAutoLessonResult(input: {
  verdict: "CORRECT" | "INCORRECT" | "UNCERTAIN";
  currentResult: string | null;
  hadIncorrectBefore: boolean;
}): AutoLessonResult | null {
  const { verdict, currentResult, hadIncorrectBefore } = input;

  if (verdict === "UNCERTAIN") {
    return null;
  }

  if (currentResult === "SOLVED" || currentResult === "PARTIAL" || currentResult === "SKIPPED") {
    return null;
  }

  if (verdict === "INCORRECT") {
    return currentResult === "NOT_SOLVED" ? null : "NOT_SOLVED";
  }

  // CORRECT: прошлые ошибочные попытки или уже стоящее «не решил» — значит, решил не с первого раза.
  return hadIncorrectBefore || currentResult === "NOT_SOLVED" ? "PARTIAL" : "SOLVED";
}

/**
 * Итог по окончании урока для номера без отметки (правило владельца):
 * ученик вообще не сдавал номер — «не успел» (мог не дойти и до основной
 * части); сдавал, но решение так и не зачтено — «не решил».
 */
export function decideEndOfLessonResult(input: {
  currentResult: string | null;
  hasSubmission: boolean;
}): "NOT_SOLVED" | "SKIPPED" | null {
  if (input.currentResult !== null) {
    return null;
  }

  return input.hasSubmission ? "NOT_SOLVED" : "SKIPPED";
}
