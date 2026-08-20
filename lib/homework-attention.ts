import { HomeworkNumberStatus } from "@prisma/client";

// Сортировка списков ДЗ по требуемому вниманию, а не по дате создания.
// Одна функция обслуживает и ученика, и учителя: оба читают
// getTeacherStudentHomeworks* в lib/platform-data.ts.

type DateLike = Date | string;

export type AttentionHomework = {
  createdAt: DateLike;
  deadlineAt: DateLike | null;
  numbers: Array<{ status: HomeworkNumberStatus | null }>;
  latestCheck?: { status: string; results: Array<{ verdict: string }> } | null;
};

// «Срок скоро» — дедлайн в ближайшие трое суток.
const SOON_WINDOW_MS = 72 * 60 * 60 * 1000;

function toTime(value: DateLike | null): number | null {
  if (value === null) {
    return null;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : time;
}

export function isAttentionHomeworkCompleted(homework: AttentionHomework): boolean {
  return (
    homework.numbers.length > 0 &&
    homework.numbers.every(
      (entry) => entry.status === HomeworkNumberStatus.GREEN || entry.status === HomeworkNumberStatus.YELLOW
    )
  );
}

/**
 * Ранг внимания: чем меньше, тем выше в списке.
 * 0 — просрочено; 1 — ИИ оставил вердикты «на проверке»; 2 — есть неотмеченные
 * номера; 3 — дедлайн в ближайшие 72 часа; 4 — остальное; 5 — выполненные.
 */
export function homeworkAttentionRank(homework: AttentionHomework, now: number): number {
  if (isAttentionHomeworkCompleted(homework)) {
    return 5;
  }

  const deadline = toTime(homework.deadlineAt);

  if (deadline !== null && deadline < now) {
    return 0;
  }

  const latestCheck = homework.latestCheck ?? null;

  if (latestCheck?.status === "DONE" && latestCheck.results.some((result) => result.verdict === "UNCERTAIN")) {
    return 1;
  }

  if (homework.numbers.some((entry) => entry.status === null)) {
    return 2;
  }

  if (deadline !== null && deadline - now <= SOON_WINDOW_MS) {
    return 3;
  }

  return 4;
}

/**
 * Порядок: просрочено → непросмотренные вердикты → неотмеченные → срок скоро →
 * остальное → выполненные. Внутри ранга — ближайший дедлайн первым, затем
 * более свежие по дате создания.
 */
export function sortHomeworksByAttention<T extends AttentionHomework>(homeworks: T[], now = Date.now()): T[] {
  return [...homeworks].sort((left, right) => {
    const rankDiff = homeworkAttentionRank(left, now) - homeworkAttentionRank(right, now);

    if (rankDiff !== 0) {
      return rankDiff;
    }

    const leftDeadline = toTime(left.deadlineAt);
    const rightDeadline = toTime(right.deadlineAt);

    if (leftDeadline !== null && rightDeadline !== null && leftDeadline !== rightDeadline) {
      return leftDeadline - rightDeadline;
    }

    if ((leftDeadline === null) !== (rightDeadline === null)) {
      return leftDeadline === null ? 1 : -1;
    }

    return (toTime(right.createdAt) ?? 0) - (toTime(left.createdAt) ?? 0);
  });
}
