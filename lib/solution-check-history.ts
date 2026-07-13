import type { SolutionCheckStatus } from "@prisma/client";

export const MAX_COMPLETED_CHECKS_PER_STUDENT = 50;

type CheckHistoryEntry = {
  id: string;
  status: SolutionCheckStatus;
};

/**
 * Expects newest-first input. Active checks never count towards the completed
 * history limit and are never selected for pruning.
 */
export function selectCompletedCheckIdsToPrune(
  checks: CheckHistoryEntry[],
  limit = MAX_COMPLETED_CHECKS_PER_STUDENT
) {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : MAX_COMPLETED_CHECKS_PER_STUDENT;
  let completedCount = 0;
  const ids: string[] = [];

  for (const check of checks) {
    if (check.status === "PENDING" || check.status === "CHECKING") {
      continue;
    }

    completedCount += 1;

    if (completedCount > safeLimit) {
      ids.push(check.id);
    }
  }

  return ids;
}
