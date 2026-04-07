import { HomeworkNumberStatus } from "@prisma/client";
import type { StudentDeadline } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

export type StudentDeadlineAssignmentStatus = "DONE" | "IN_PROGRESS" | "NOT_STARTED";

export type StudentDeadlineAssignment = {
  id: string;
  deadlineAt: string;
  topicId: string;
  topicTitle: string;
  totalNumbers: number;
  solvedNumbers: number;
  status: StudentDeadlineAssignmentStatus;
};

export function groupStudentDeadlinesAsAssignments(
  deadlines: StudentDeadline[]
): StudentDeadlineAssignment[] {
  const grouped = new Map<
    string,
    {
      id: string;
      deadlineAt: string;
      topicId: string;
      topicTitle: string;
      statuses: Array<HomeworkNumberStatus | null>;
    }
  >();

  for (const deadline of deadlines) {
    const deadlineAt = toIsoDateTimeString(deadline.deadlineAt);

    if (!deadlineAt) {
      continue;
    }

    const key = `${deadline.topicId}::${deadlineAt}`;
    const current = grouped.get(key);

    if (current) {
      current.statuses.push(deadline.status);
      continue;
    }

    grouped.set(key, {
      id: key,
      deadlineAt,
      topicId: deadline.topicId,
      topicTitle: deadline.topicTitle,
      statuses: [deadline.status]
    });
  }

  return Array.from(grouped.values())
    .map((group) => {
      const totalNumbers = group.statuses.length;
      const solvedNumbers = group.statuses.filter(
        (status) => status === HomeworkNumberStatus.GREEN || status === HomeworkNumberStatus.YELLOW
      ).length;
      const startedNumbers = group.statuses.filter((status) => status !== null).length;
      const status: StudentDeadlineAssignmentStatus =
        solvedNumbers === totalNumbers
          ? "DONE"
          : startedNumbers > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED";

      return {
        id: group.id,
        deadlineAt: group.deadlineAt,
        topicId: group.topicId,
        topicTitle: group.topicTitle,
        totalNumbers,
        solvedNumbers,
        status
      };
    })
    .sort((left, right) => new Date(left.deadlineAt).getTime() - new Date(right.deadlineAt).getTime());
}
