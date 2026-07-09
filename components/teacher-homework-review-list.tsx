"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { cx, homeworkStatusMeta } from "@/lib/utils";
import { ProgressBar } from "@/components/progress-bar";

type CheckVerdict = "CORRECT" | "INCORRECT" | "UNCERTAIN";

type CheckResult = {
  number: number;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
  copySuspected: boolean;
  copyReason: string | null;
};

type AssignmentCheck = {
  id: string;
  status: "PENDING" | "CHECKING" | "DONE" | "FAILED";
  createdAt: string;
  checkedAt: string | null;
  results: CheckResult[];
};

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
  checks: AssignmentCheck[];
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

const verdictMeta: Record<
  CheckVerdict,
  { chip: string; short: string; color: string; background: string; stripe: string }
> = {
  CORRECT: {
    chip: "ИИ: Верно",
    short: "верно",
    color: "var(--shbz-green-text)",
    background: "var(--shbz-green-soft)",
    stripe: "#36e0a4"
  },
  INCORRECT: {
    chip: "ИИ: Ошибка",
    short: "ошибка",
    color: "var(--shbz-danger-text)",
    background: "var(--shbz-danger-bg)",
    stripe: "var(--shbz-danger-text)"
  },
  UNCERTAIN: {
    chip: "ИИ: на проверке",
    short: "на проверке",
    color: "var(--shbz-kicker)",
    background: "var(--shbz-tab-hover)",
    stripe: "var(--shbz-kicker)"
  }
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

function formatRunDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);

  return `${day}, ${time}`;
}

function pluralizeRuns(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} запуск`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} запуска`;
  }

  return `${count} запусков`;
}

function shortenRecognizedAnswer(answer: string): string {
  const trimmed = answer.trim();
  const parts = trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 5 && trimmed.length > 80) {
    return `${parts[0]}; ${parts[1]}; …; ${parts[parts.length - 1]}`;
  }

  if (trimmed.length > 140) {
    return `${trimmed.slice(0, 137).trimEnd()}…`;
  }

  return trimmed;
}

function countVerdicts(results: CheckResult[]) {
  return results.reduce(
    (acc, result) => {
      acc[result.verdict] += 1;
      return acc;
    },
    { CORRECT: 0, INCORRECT: 0, UNCERTAIN: 0 } as Record<CheckVerdict, number>
  );
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

        const latestDone = assignment.checks.find((check) => check.status === "DONE") ?? null;
        const aiByNumber = new Map(latestDone?.results.map((result) => [result.number, result]) ?? []);
        const lastCheckedLabel = formatDateTime(latestDone?.checkedAt ?? null);

        return (
          <article key={assignment.id} className="teacher-topic-card rounded-[18px] border p-5 sm:p-6">
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

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="rounded-[10px] border px-3.5 py-1.5 text-sm font-bold"
                style={{
                  borderColor: "var(--shbz-outline-border)",
                  background: "var(--shbz-card-bg)",
                  color: "var(--shbz-text-strong)"
                }}
              >
                Решено {assignment.solvedCount}/{assignment.totalNumbers}
              </span>
              <span
                className="rounded-[10px] border px-3.5 py-1.5 text-sm font-bold"
                style={{
                  borderColor: "var(--shbz-outline-border)",
                  background: "var(--shbz-card-bg)",
                  color: "var(--shbz-text-strong)"
                }}
              >
                Красные <span style={{ color: "var(--shbz-danger-text)" }}>{assignment.redCount}</span>
              </span>
              <span
                className="rounded-[10px] border px-3.5 py-1.5 text-sm font-bold"
                style={{
                  borderColor: "var(--shbz-outline-border)",
                  background: "var(--shbz-card-bg)",
                  color: "var(--shbz-text-strong)"
                }}
              >
                Не отмечено {unmarkedCount}
              </span>
            </div>

            <div className="mt-3">
              <ProgressBar value={assignment.solvedPercent} size="sm" />
            </div>

            {assignment.photos.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2">
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
                        className="h-16 w-16 rounded-[14px] border object-cover transition hover:opacity-80"
                        style={{ borderColor: "var(--shbz-soft-border)" }}
                      />
                    </a>
                  ))}
                </div>
                <p className="text-sm">
                  <span className="font-bold text-[var(--theme-text-strong)]">
                    Фото решения ({assignment.photos.length})
                  </span>
                  {lastCheckedLabel ? (
                    <span className="ui-copy-muted"> · посл. автопроверка {lastCheckedLabel}</span>
                  ) : null}
                </p>
              </div>
            ) : (
              <p className="ui-copy-muted mt-4 text-sm">Ученик пока не прикрепил фото решения.</p>
            )}

            <p className="ui-kicker mt-5">Номера</p>
            <div className="mt-2.5 space-y-2.5">
              {assignment.numbers.map((number) => {
                const ai = aiByNumber.get(number.number) ?? null;
                const aiMeta = ai ? verdictMeta[ai.verdict] : null;
                const showAnswer = Boolean(ai && ai.verdict !== "UNCERTAIN" && ai.recognizedAnswer);

                return (
                  <div
                    key={number.homeworkNumberId}
                    className="teacher-number-card rounded-[14px] border border-l-[3px] px-4 py-3.5"
                    style={{ borderLeftColor: aiMeta ? aiMeta.stripe : "var(--theme-border-soft)" }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="teacher-number-title text-lg font-semibold text-[var(--theme-text-strong)]">
                            № {number.number}
                          </span>
                          {aiMeta ? (
                            <span
                              className="rounded-[8px] px-2.5 py-0.5 text-[11.5px] font-bold"
                              style={{ background: aiMeta.background, color: aiMeta.color }}
                            >
                              {aiMeta.chip}
                            </span>
                          ) : null}
                          {ai?.copySuspected ? (
                            <span
                              className="rounded-[8px] px-2.5 py-0.5 text-[11.5px] font-bold"
                              style={{ background: "var(--shbz-cal-ok-bg)", color: "var(--shbz-streak-text)" }}
                              title={ai.copyReason ?? undefined}
                            >
                              Похоже на списанное
                            </span>
                          ) : null}
                          <HomeworkStatusBadge status={number.status} />
                        </div>

                        {showAnswer && ai ? (
                          <p className="ui-copy-muted mt-1.5 text-sm" title={ai.recognizedAnswer ?? undefined}>
                            Распознано: {shortenRecognizedAnswer(ai.recognizedAnswer ?? "")}
                          </p>
                        ) : null}
                        {ai?.comment ? <p className="ui-copy-muted mt-1 text-sm leading-6">{ai.comment}</p> : null}
                        {ai?.copySuspected && ai.copyReason ? (
                          <p className="mt-1 text-xs leading-5" style={{ color: "var(--shbz-streak-text)" }}>
                            Подозрение: {ai.copyReason}
                          </p>
                        ) : null}
                        {number.note ? (
                          <div className="ui-card-soft mt-2 rounded-[10px] px-3 py-1.5">
                            <p className="text-sm leading-6 text-[var(--theme-text-default)]">{number.note}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-none flex-wrap items-center gap-1.5">
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
                                "ui-pressable rounded-[8px] px-3.5 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                                isActive ? meta.buttonClassName : "ui-status-button"
                              )}
                            >
                              {meta.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {assignment.checks.length > 0 ? (
              <details className="group mt-5 rounded-[14px] border" style={{ borderColor: "var(--shbz-soft-border)" }} open>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="text-[15px] font-bold text-[var(--theme-text-strong)]">История проверок</span>
                  <span className="ui-copy-muted text-sm">· {pluralizeRuns(assignment.checks.length)}</span>
                  <svg
                    className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ color: "var(--shbz-kicker)" }}
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>

                <div className="px-4 pb-4">
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute bottom-3 left-[5px] top-3 w-px"
                      style={{ background: "var(--shbz-soft-border)" }}
                    />
                    <div>
                      {assignment.checks.map((check) => {
                        const counts = countVerdicts(check.results);
                        const timeLabel = formatRunDateTime(check.checkedAt ?? check.createdAt) ?? "—";
                        const isCurrent = latestDone !== null && check.id === latestDone.id;
                        const isRunning = check.status === "PENDING" || check.status === "CHECKING";

                        const headerRow = (
                          <>
                            <span className="text-sm font-bold text-[var(--theme-text-strong)]">{timeLabel}</span>
                            {isCurrent ? (
                              <span
                                className="rounded-[7px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
                                style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
                              >
                                Текущая
                              </span>
                            ) : null}
                            {check.status === "FAILED" ? (
                              <span
                                className="rounded-[7px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
                                style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}
                              >
                                Сбой
                              </span>
                            ) : null}
                            {isRunning ? (
                              <span
                                className="rounded-[7px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
                                style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}
                              >
                                Выполняется
                              </span>
                            ) : null}
                            <span className="ml-auto flex flex-wrap gap-1.5">
                              {counts.CORRECT > 0 ? (
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                  style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
                                >
                                  Верно {counts.CORRECT}
                                </span>
                              ) : null}
                              {counts.INCORRECT > 0 ? (
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                  style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}
                                >
                                  Ошибка {counts.INCORRECT}
                                </span>
                              ) : null}
                              {counts.UNCERTAIN > 0 ? (
                                <span
                                  className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                                  style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}
                                >
                                  На проверке {counts.UNCERTAIN}
                                </span>
                              ) : null}
                            </span>
                          </>
                        );

                        return (
                          <div key={check.id} className="relative pl-6">
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-[13px] h-[11px] w-[11px] rounded-full"
                              style={{
                                background: isCurrent ? "#36e0a4" : "var(--shbz-soft-border)",
                                boxShadow: "0 0 0 3px var(--shbz-card-bg)"
                              }}
                            />
                            {check.results.length > 0 ? (
                              <details>
                                <summary
                                  className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-[10px] px-2 py-2 transition hover:bg-[var(--shbz-tab-hover)] [&::-webkit-details-marker]:hidden"
                                  title="Показать вердикты по номерам"
                                >
                                  {headerRow}
                                </summary>
                                <div className="flex flex-wrap gap-1.5 px-2 pb-2.5 pt-1">
                                  {check.results.map((result) => (
                                    <span
                                      key={result.number}
                                      className="rounded-[8px] border px-2.5 py-1 text-[12px] font-semibold"
                                      style={{
                                        borderColor: "var(--shbz-outline-border)",
                                        background: "var(--shbz-card-bg)"
                                      }}
                                    >
                                      <span className="font-bold text-[var(--theme-text-strong)]">№ {result.number}</span>
                                      <span style={{ color: verdictMeta[result.verdict].color }}>
                                        {" "}
                                        — {verdictMeta[result.verdict].short}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </details>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 px-2 py-2">{headerRow}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </details>
            ) : null}
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
