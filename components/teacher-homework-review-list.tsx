"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";

type ReviewAssignment = {
  id: string;
  label: string;
  topicId: string;
  topicTitle: string;
  deadlineAt: string | null;
  createdAt: string;
  totalNumbers: number;
  markedCount: number;
  redCount: number;
  solvedCount: number;
  solvedPercent: number;
  numbers: Array<{
    homeworkNumberId: string;
    number: number;
    status: HomeworkNumberStatus | null;
    note: string;
  }>;
};

type TeacherHomeworkReviewListProps = {
  assignments: ReviewAssignment[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function TeacherHomeworkReviewList({ assignments }: TeacherHomeworkReviewListProps) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelAssignment = async (assignmentId: string) => {
    if (!window.confirm("Отменить это ДЗ? Дедлайны будут сняты с его номеров.")) {
      return;
    }

    setCancelingId(assignmentId);
    setError(null);

    try {
      const response = await fetch("/api/teacher/homeworks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assignmentId })
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось отменить ДЗ.");
      }

      router.refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Не удалось отменить ДЗ.");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      {assignments.map((assignment) => {
        const deadlineLabel = formatDateTime(assignment.deadlineAt);
        const createdLabel = formatDateTime(assignment.createdAt);
        const isCompleted = assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers;
        const isOverdue =
          !isCompleted && assignment.deadlineAt !== null && new Date(assignment.deadlineAt).getTime() < Date.now();
        const unmarkedCount = assignment.totalNumbers - assignment.markedCount;

        return (
          <article key={assignment.id} className="teacher-topic-card rounded-[12px] border p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="teacher-topic-title font-display text-xl font-semibold text-[var(--theme-text-strong)]">
                    {assignment.label}
                  </h3>
                  {isCompleted ? (
                    <Badge className="border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]">
                      Выполнено
                    </Badge>
                  ) : null}
                  {isOverdue ? (
                    <Badge className="border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger-text)]">
                      Просрочено
                    </Badge>
                  ) : null}
                </div>
                <p className="ui-copy-muted text-sm">{assignment.topicTitle}</p>
                <p className="ui-copy-muted text-xs">
                  {createdLabel ? `Выдано ${createdLabel}` : null}
                  {createdLabel && deadlineLabel ? " · " : null}
                  {deadlineLabel ? `дедлайн до ${deadlineLabel}` : null}
                </p>
              </div>

              <div className="flex flex-none items-center gap-3">
                <button
                  type="button"
                  disabled={cancelingId === assignment.id}
                  onClick={() => void cancelAssignment(assignment.id)}
                  className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {cancelingId === assignment.id ? "Отменяем..." : "Отменить ДЗ"}
                </button>
              </div>
            </div>

            <div className="ui-copy-muted mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <span>
                Решено:{" "}
                <span className="font-semibold text-[var(--theme-text-strong)]">
                  {assignment.solvedCount}/{assignment.totalNumbers}
                </span>
              </span>
              <span>
                Красные: <span className="font-semibold text-[var(--theme-danger-text)]">{assignment.redCount}</span>
              </span>
              <span>
                Не отмечено: <span className="font-semibold text-[var(--theme-text-strong)]">{unmarkedCount}</span>
              </span>
            </div>

            <div className="mt-3">
              <ProgressBar value={assignment.solvedPercent} size="sm" />
            </div>

            <div className="teacher-number-grid mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {assignment.numbers.map((number) => (
                <div key={number.homeworkNumberId} className="teacher-number-card rounded-[10px] border px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="teacher-number-title text-lg font-semibold text-[var(--theme-text-strong)]">
                      № {number.number}
                    </p>
                    <HomeworkStatusBadge status={number.status} />
                  </div>
                  {number.note ? (
                    <div className="ui-card-soft mt-3 rounded-[12px] px-3 py-2">
                      <p className="text-sm leading-6 text-[var(--theme-text-default)]">{number.note}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
