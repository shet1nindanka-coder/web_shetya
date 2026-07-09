"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { cx, homeworkStatusMeta } from "@/lib/utils";
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
  photos: Array<{
    id: string;
    fileId: string;
    originalName: string;
  }>;
  aiCheck: {
    status: string;
    checkedAt: string | null;
    results: Array<{
      number: number;
      verdict: "CORRECT" | "INCORRECT" | "UNCERTAIN";
      recognizedAnswer: string | null;
      comment: string | null;
      copySuspected: boolean;
      copyReason: string | null;
    }>;
  } | null;
  numbers: Array<{
    homeworkNumberId: string;
    number: number;
    status: HomeworkNumberStatus | null;
    note: string;
  }>;
};

type TeacherHomeworkReviewListProps = {
  studentId: string;
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

const statusOptions = [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED] as const;

export function TeacherHomeworkReviewList({ studentId, assignments }: TeacherHomeworkReviewListProps) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setNumberStatus = async (homeworkNumberId: string, status: HomeworkNumberStatus | null) => {
    setSavingStatusId(homeworkNumberId);
    setError(null);

    try {
      const response = await fetch("/api/teacher/number-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ studentId, homeworkNumberId, status })
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось сохранить статус.");
      }

      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Не удалось сохранить статус.");
    } finally {
      setSavingStatusId(null);
    }
  };

  const cancelAssignment = async (assignmentId: string) => {
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
      setConfirmCancelId(null);
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
                  onClick={() => setConfirmCancelId(assignment.id)}
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

            {assignment.photos.length > 0 ? (
              <div className="mt-4">
                <p className="ui-copy-muted text-sm font-medium">Фото решения ({assignment.photos.length})</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {assignment.photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={`/files/${photo.fileId}`}
                      target="_blank"
                      rel="noreferrer"
                      title={photo.originalName}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/files/${photo.fileId}`}
                        alt={photo.originalName}
                        className="h-28 w-28 rounded-[12px] border object-cover transition hover:opacity-80"
                        style={{ borderColor: "var(--shbz-soft-border)" }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="ui-copy-muted mt-4 text-sm">Ученик пока не прикрепил фото решения.</p>
            )}

            {assignment.aiCheck && assignment.aiCheck.results.length > 0 ? (
              <div className="mt-4">
                <p className="ui-copy-muted text-sm font-medium">
                  Автоматическая проверка
                  {assignment.aiCheck.checkedAt ? ` · ${formatDateTime(assignment.aiCheck.checkedAt) ?? ""}` : ""}
                </p>
                <div className="mt-2 space-y-2">
                  {assignment.aiCheck.results.map((result) => (
                    <div
                      key={result.number}
                      className="rounded-[12px] border px-4 py-2.5"
                      style={{ borderColor: "var(--shbz-soft-border)", background: "var(--shbz-card-bg)" }}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-extrabold text-[var(--theme-text-strong)]">№ {result.number}</span>
                        <span
                          className="rounded-[8px] px-2.5 py-0.5 text-[11.5px] font-bold"
                          style={{
                            background:
                              result.verdict === "CORRECT"
                                ? "var(--shbz-green-soft)"
                                : result.verdict === "INCORRECT"
                                  ? "var(--shbz-danger-bg)"
                                  : "var(--shbz-tab-hover)",
                            color:
                              result.verdict === "CORRECT"
                                ? "var(--shbz-green-text)"
                                : result.verdict === "INCORRECT"
                                  ? "var(--shbz-danger-text)"
                                  : "var(--shbz-kicker)"
                          }}
                        >
                          {result.verdict === "CORRECT"
                            ? "Верно"
                            : result.verdict === "INCORRECT"
                              ? "Ошибка"
                              : "Нужна проверка учителем"}
                        </span>
                        {result.copySuspected ? (
                          <span
                            className="rounded-[8px] px-2.5 py-0.5 text-[11.5px] font-bold"
                            style={{ background: "var(--shbz-cal-ok-bg)", color: "var(--shbz-streak-text)" }}
                            title={result.copyReason ?? undefined}
                          >
                            Похоже на списанное
                          </span>
                        ) : null}
                        {result.recognizedAnswer ? (
                          <span className="ui-copy-muted text-xs">Распознано: {result.recognizedAnswer}</span>
                        ) : null}
                      </div>
                      {result.comment ? (
                        <p className="ui-copy-muted mt-1 text-sm leading-6">{result.comment}</p>
                      ) : null}
                      {result.copySuspected && result.copyReason ? (
                        <p className="mt-1 text-xs leading-5" style={{ color: "var(--shbz-streak-text)" }}>
                          Подозрение: {result.copyReason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="teacher-number-grid mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {assignment.numbers.map((number) => (
                <div key={number.homeworkNumberId} className="teacher-number-card rounded-[10px] border px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="teacher-number-title text-lg font-semibold text-[var(--theme-text-strong)]">
                      № {number.number}
                    </p>
                    <HomeworkStatusBadge status={number.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {statusOptions.map((option) => {
                      const meta = homeworkStatusMeta[option];
                      const isActive = number.status === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isActive}
                          disabled={savingStatusId === number.homeworkNumberId}
                          onClick={() => void setNumberStatus(number.homeworkNumberId, isActive ? null : option)}
                          className={cx(
                            "ui-pressable rounded-[8px] px-2 py-1.5 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                            isActive ? meta.buttonClassName : "ui-status-button"
                          )}
                        >
                          {meta.shortLabel}
                        </button>
                      );
                    })}
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

      <ConfirmDialog
        open={confirmCancelId !== null}
        title="Отменить ДЗ?"
        description="ДЗ будет удалено, дедлайны будут сняты с его номеров. Это действие нельзя отменить."
        confirmLabel="Да, отменить"
        pendingLabel="Отменяем..."
        isPending={cancelingId !== null}
        onConfirm={() => {
          if (confirmCancelId) {
            void cancelAssignment(confirmCancelId);
          }
        }}
        onCancel={() => setConfirmCancelId(null)}
      />
    </div>
  );
}
