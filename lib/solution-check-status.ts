import { HomeworkNumberStatus } from "@prisma/client";
import type { CheckVerdict } from "@/lib/solution-check-parse";

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
