import { HomeworkNumberStatus } from "@prisma/client";
import type { CheckVerdict } from "@/lib/solution-check-parse";

const STATUS_RANK: Record<HomeworkNumberStatus, number> = {
  [HomeworkNumberStatus.GREEN]: 3,
  [HomeworkNumberStatus.YELLOW]: 2,
  [HomeworkNumberStatus.RED]: 1
};

// Автопроверка может только улучшать статус (пустой → любой, красный → жёлтый),
// но не понижать выставленный ранее (в т.ч. учителем) — решение пользователя от 14.07.2026.
export function isStatusDowngrade(
  next: HomeworkNumberStatus,
  previous: HomeworkNumberStatus | null
) {
  if (!previous) {
    return false;
  }

  return STATUS_RANK[next] < STATUS_RANK[previous];
}

export function getStatusForAiVerdict(
  verdict: CheckVerdict,
  previousStatus: HomeworkNumberStatus | null
) {
  if (verdict === "UNCERTAIN") {
    return null;
  }

  if (verdict === "INCORRECT") {
    return HomeworkNumberStatus.RED;
  }

  return previousStatus === HomeworkNumberStatus.RED || previousStatus === HomeworkNumberStatus.YELLOW
    ? HomeworkNumberStatus.YELLOW
    : HomeworkNumberStatus.GREEN;
}
