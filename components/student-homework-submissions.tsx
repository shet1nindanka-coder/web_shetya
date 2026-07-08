import { HomeworkNumberStatus } from "@prisma/client";
import Link from "next/link";
import { HomeworkDoneBadge } from "@/components/deadline-list";
import { cx, formatDate, homeworkStatusMeta } from "@/lib/utils";

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

export function StudentHomeworkSubmissions({ assignments }: StudentHomeworkSubmissionsProps) {
  return (
    <div className="space-y-4">
      {assignments.map((assignment) => (
        <article key={assignment.id} className="shbz-card px-[26px] py-6" style={{ borderRadius: 18 }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[17px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
                  {assignment.label} · {assignment.topicTitle}
                </span>
                {assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers ? (
                  <HomeworkDoneBadge />
                ) : null}
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
                    "rounded-[10px] border px-3.5 py-2 text-sm font-bold",
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
      ))}
    </div>
  );
}
