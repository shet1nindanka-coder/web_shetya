import { HomeworkNumberStatus } from "@prisma/client";
import Link from "next/link";
import { HomeworkDoneBadge, HomeworkOverdueBadge } from "@/components/deadline-list";
import { cx, formatDate, homeworkStatusMeta, isHomeworkOverdue } from "@/lib/utils";

type SubmissionAssignment = {
  id: string;
  label: string;
  topicId: string;
  topicTitle: string;
  deadlineAt: string | null;
  totalNumbers: number;
  solvedCount: number;
  solvedPercent: number;
  photosCount: number;
  numbers: Array<{
    homeworkNumberId: string;
    number: number;
    status: HomeworkNumberStatus | null;
  }>;
};

type StudentHomeworkSubmissionsProps = {
  assignments: SubmissionAssignment[];
};

function isCompleted(assignment: SubmissionAssignment) {
  return assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers;
}

function isDeadlinePassed(deadlineAt: string | null) {
  if (!deadlineAt) {
    return false;
  }

  const deadline = new Date(deadlineAt);

  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
}

function HomeworkCard({ assignment }: { assignment: SubmissionAssignment }) {
  const completed = isCompleted(assignment);

  return (
    <article className="shbz-card px-[26px] py-6" style={{ borderRadius: 16 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
              {assignment.label} · {assignment.topicTitle}
            </span>
            {completed ? <HomeworkDoneBadge /> : null}
            {isHomeworkOverdue(assignment.deadlineAt, completed) ? <HomeworkOverdueBadge /> : null}
          </div>
          <div className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            {assignment.deadlineAt ? `ДЗ до ${formatDate(assignment.deadlineAt)} · ` : ""}
            Выполнено {assignment.solvedCount} из {assignment.totalNumbers}
            {assignment.photosCount > 0 ? ` · Фото: ${assignment.photosCount}` : ""}
          </div>
        </div>

        <Link
          href={`/student/homeworks/${assignment.id}`}
          className="shbz-btn-primary shrink-0 px-6 py-3 text-[14.5px]"
        >
          Открыть ДЗ
        </Link>
      </div>

      {assignment.numbers.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {assignment.numbers.map((number) => (
            <span
              key={number.homeworkNumberId}
              title={number.status ? homeworkStatusMeta[number.status].label : "Номер ещё не отмечен"}
              className={cx(
                "rounded-[8px] border px-3.5 py-2 text-sm font-bold",
                number.status
                  ? homeworkStatusMeta[number.status].subtleClassName
                  : "border-[var(--theme-border)] bg-[var(--theme-surface-strong)] text-[var(--theme-text-default)]"
              )}
            >
              № {number.number}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 shbz-progress-track">
        <div className="shbz-progress-fill" style={{ width: `${assignment.solvedPercent}%` }} />
      </div>
    </article>
  );
}

export function StudentHomeworkSubmissions({ assignments }: StudentHomeworkSubmissionsProps) {
  const archived = assignments.filter(
    (assignment) => isCompleted(assignment) && isDeadlinePassed(assignment.deadlineAt)
  );
  const active = assignments.filter(
    (assignment) => !(isCompleted(assignment) && isDeadlinePassed(assignment.deadlineAt))
  );

  return (
    <div className="space-y-4">
      {active.map((assignment) => (
        <HomeworkCard key={assignment.id} assignment={assignment} />
      ))}

      {active.length === 0 ? (
        <div
          className="rounded-[8px] px-3.5 py-2 text-[13px] font-medium"
          style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", display: "inline-block" }}
        >
          Все ДЗ выполнены — новых пока нет.
        </div>
      ) : null}

      {archived.length > 0 ? (
        <details className="group pt-2">
          <summary
            className="ui-pressable inline-flex cursor-pointer list-none items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-bold [&::-webkit-details-marker]:hidden"
            style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}
          >
            Выполненные ДЗ ({archived.length})
            <svg
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="mt-4 space-y-4">
            {archived.map((assignment) => (
              <HomeworkCard key={assignment.id} assignment={assignment} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
