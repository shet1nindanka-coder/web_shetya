"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/badge";
import { DeleteButton } from "@/components/delete-button";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { cx, homeworkStatusMeta } from "@/lib/utils";
import { ProgressBar } from "@/components/progress-bar";

type CheckVerdict = "CORRECT" | "INCORRECT" | "UNCERTAIN";

type CheckResult = {
  number: string;
  verdict: CheckVerdict;
  recognizedAnswer: string | null;
  comment: string | null;
  copySuspected: boolean;
  copyReason: string | null;
  injectionSuspected: boolean;
  injectionNote: string | null;
};

type AssignmentCheck = {
  id: string;
  status: "PENDING" | "CHECKING" | "DONE" | "FAILED";
  createdAt: string;
  checkedAt: string | null;
  photos: Array<{ fileId: string; originalName: string }>;
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
    number: string;
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
    stripe: "var(--shbz-accent-solid)"
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

const ACCEPT_UNDO_MS = 10_000;

export function TeacherHomeworkReviewList({ studentId, assignments }: TeacherHomeworkReviewListProps) {
  const router = useRouter();
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Режим урока: ноутбук повёрнут к ученику — служебная диагностика
  // (списывание, инъекции) временно прячется целиком.
  const [lessonMode, setLessonMode] = useState(false);

  const hasDiagnostics = assignments.some((assignment) =>
    assignment.checks.some((check) =>
      check.results.some((result) => result.copySuspected || result.injectionSuspected)
    )
  );

  // Оптимистичное локальное состояние статусов: клик подсвечивается сразу,
  // без router.refresh() на каждое нажатие.
  const [localStatuses, setLocalStatuses] = useState<Record<string, HomeworkNumberStatus | null>>({});
  // Тост «Вердикты приняты» с 10-секундной отменой.
  const [acceptUndo, setAcceptUndo] = useState<{
    label: string;
    previous: Array<{ homeworkNumberId: string; status: HomeworkNumberStatus | null }>;
  } | null>(null);
  const acceptUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (acceptUndoTimer.current) {
        clearTimeout(acceptUndoTimer.current);
      }
    };
  }, []);

  const effectiveStatus = (homeworkNumberId: string, serverStatus: HomeworkNumberStatus | null) =>
    homeworkNumberId in localStatuses ? localStatuses[homeworkNumberId] : serverStatus;

  const pushStatus = async (homeworkNumberId: string, status: HomeworkNumberStatus | null) => {
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
  };

  const setNumberStatus = async (
    homeworkNumberId: string,
    status: HomeworkNumberStatus | null,
    previous: HomeworkNumberStatus | null
  ) => {
    setSavingStatusId(homeworkNumberId);
    setError(null);
    setLocalStatuses((current) => ({ ...current, [homeworkNumberId]: status }));

    try {
      await pushStatus(homeworkNumberId, status);
    } catch (statusError) {
      // Откат оптимистичного значения при неудаче.
      setLocalStatuses((current) => ({ ...current, [homeworkNumberId]: previous }));
      setError(statusError instanceof Error ? statusError.message : "Не удалось сохранить статус.");
    } finally {
      setSavingStatusId(null);
    }
  };

  // «Принять вердикты ИИ»: CORRECT→GREEN, INCORRECT→RED, UNCERTAIN не трогаем.
  const acceptAiVerdicts = async (assignment: ReviewAssignment) => {
    const latestDone = assignment.checks.find((check) => check.status === "DONE") ?? null;

    if (!latestDone) {
      return;
    }

    const byNumber = new Map(assignment.numbers.map((number) => [number.number, number]));
    const changes: Array<{
      homeworkNumberId: string;
      next: HomeworkNumberStatus;
      previous: HomeworkNumberStatus | null;
    }> = [];

    for (const result of latestDone.results) {
      const target = byNumber.get(result.number);

      if (!target || result.verdict === "UNCERTAIN") {
        continue;
      }

      const next = result.verdict === "CORRECT" ? HomeworkNumberStatus.GREEN : HomeworkNumberStatus.RED;
      const previous = effectiveStatus(target.homeworkNumberId, target.status);

      if (previous !== next) {
        changes.push({ homeworkNumberId: target.homeworkNumberId, next, previous });
      }
    }

    if (changes.length === 0) {
      return;
    }

    setError(null);
    setLocalStatuses((current) => {
      const merged = { ...current };

      for (const change of changes) {
        merged[change.homeworkNumberId] = change.next;
      }

      return merged;
    });

    if (acceptUndoTimer.current) {
      clearTimeout(acceptUndoTimer.current);
    }

    setAcceptUndo({
      label: `Вердикты ИИ приняты: ${changes.length}`,
      previous: changes.map((change) => ({ homeworkNumberId: change.homeworkNumberId, status: change.previous }))
    });
    acceptUndoTimer.current = setTimeout(() => setAcceptUndo(null), ACCEPT_UNDO_MS);

    try {
      await Promise.all(changes.map((change) => pushStatus(change.homeworkNumberId, change.next)));
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Не удалось применить вердикты.");
      router.refresh();
    }
  };

  const undoAcceptAiVerdicts = async () => {
    if (!acceptUndo) {
      return;
    }

    if (acceptUndoTimer.current) {
      clearTimeout(acceptUndoTimer.current);
      acceptUndoTimer.current = null;
    }

    const { previous } = acceptUndo;

    setAcceptUndo(null);
    setLocalStatuses((current) => {
      const merged = { ...current };

      for (const entry of previous) {
        merged[entry.homeworkNumberId] = entry.status;
      }

      return merged;
    });

    try {
      await Promise.all(previous.map((entry) => pushStatus(entry.homeworkNumberId, entry.status)));
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Не удалось отменить применение вердиктов.");
      router.refresh();
    }
  };

  // Roving tabindex тройки статусов: ←/→ — между кнопками, 1/2/3 — установка,
  // ↓/↑ — к тройке следующего/предыдущего номера.
  const handleStatusGroupKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    homeworkNumberId: string,
    serverStatus: HomeworkNumberStatus | null
  ) => {
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const focusedIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      buttons[(focusedIndex + delta + buttons.length) % buttons.length]?.focus();
      return;
    }

    if (event.key === "1" || event.key === "2" || event.key === "3") {
      event.preventDefault();
      const option = statusOptions[Number(event.key) - 1];
      const current = effectiveStatus(homeworkNumberId, serverStatus);
      void setNumberStatus(homeworkNumberId, current === option ? null : option, current);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const groups = Array.from(document.querySelectorAll<HTMLDivElement>("[data-status-group]"));
      const groupIndex = groups.indexOf(event.currentTarget);
      const nextGroup = groups[groupIndex + (event.key === "ArrowDown" ? 1 : -1)];
      nextGroup?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  };

  const cancelAssignment = async (assignmentId: string) => {
    setError(null);

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
  };

  // Выполненные ДЗ схлопнуты в сводку с раскрытием, чтобы просроченное
  // не оказывалось на экране ниже выполненного.
  const completedAssignments = assignments.filter(
    (assignment) => assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers
  );
  const activeAssignments = assignments.filter((assignment) => !completedAssignments.includes(assignment));

  const renderAssignmentCard = (assignment: ReviewAssignment) => {
        const deadlineLabel = formatDateTime(assignment.deadlineAt);
        const createdLabel = formatDateTime(assignment.createdAt);
        const isCompleted = assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers;
        const isOverdue =
          !isCompleted && assignment.deadlineAt !== null && new Date(assignment.deadlineAt).getTime() < Date.now();
        const unmarkedCount = assignment.totalNumbers - assignment.markedCount;

        const latestDone = assignment.checks.find((check) => check.status === "DONE") ?? null;
        const aiByNumber = new Map(latestDone?.results.map((result) => [result.number, result]) ?? []);
        const lastCheckedLabel = formatDateTime(latestDone?.checkedAt ?? null);
        const injectionResults = latestDone?.results.filter((result) => result.injectionSuspected) ?? [];

        return (
          <article key={assignment.id} className="teacher-topic-card rounded-[16px] border p-5 sm:p-6">
            {injectionResults.length > 0 && !lessonMode ? (
              // Сигнал безопасности, а не оценка: своя полоса и нейтрально-строгая
              // палитра, чтобы не путался с «ИИ: Ошибка» (цвет INCORRECT запрещён).
              <div
                className="mb-4 rounded-[12px] border-[1.5px] px-4 py-3.5"
                style={{ borderColor: "var(--shbz-text-strong)", background: "var(--shbz-soft-bg)" }}
              >
                <p
                  className="flex items-center gap-2 text-sm font-bold"
                  style={{ color: "var(--shbz-text-strong)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 3l9 4v5c0 5-3.8 8.4-9 9-5.2-.6-9-4-9-9V7l9-4z" strokeLinejoin="round" />
                    <path d="M12 9v4" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="0.5" fill="currentColor" />
                  </svg>
                  На фото найдена надпись-инструкция для ИИ
                </p>
                {injectionResults.map((result) =>
                  result.injectionNote ? (
                    <blockquote
                      key={result.number}
                      className="mt-2 rounded-[8px] px-3 py-2 font-mono text-xs leading-5"
                      style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-text-strong)" }}
                    >
                      № {result.number}: {result.injectionNote}
                    </blockquote>
                  ) : null
                )}
                <p className="mt-2 text-xs font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
                  Вердикты этой проверки могут быть недостоверны.
                </p>
              </div>
            ) : null}
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
                <DeleteButton
                  label="Отменить ДЗ"
                  title="Отменить ДЗ?"
                  description={
                    <div className="space-y-2">
                      <p>ДЗ будет удалено, дедлайны сняты с его номеров.</p>
                      {assignment.photos.length > 0 || assignment.checks.length > 0 ? (
                        <p>
                          Вместе с ним{" "}
                          <span className="font-semibold">безвозвратно удалятся присланные учеником файлы</span>:
                          {assignment.photos.length > 0
                            ? ` фото решений — ${assignment.photos.length}`
                            : ""}
                          {assignment.photos.length > 0 && assignment.checks.length > 0 ? "," : ""}
                          {assignment.checks.length > 0
                            ? ` результаты ИИ-проверок — ${assignment.checks.length}`
                            : ""}
                          . Скачать их потом будет неоткуда.
                        </p>
                      ) : null}
                      <p>Выставленные статусы по номерам сохранятся. Это действие нельзя отменить.</p>
                    </div>
                  }
                  confirmLabel="Да, отменить"
                  pendingLabel="Отменяем..."
                  onConfirm={() => cancelAssignment(assignment.id)}
                  onError={(cancelError) =>
                    setError(cancelError instanceof Error ? cancelError.message : "Не удалось отменить ДЗ.")
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className="rounded-[8px] border px-3.5 py-1.5 text-sm font-bold"
                style={{
                  borderColor: "var(--shbz-outline-border)",
                  background: "var(--shbz-card-bg)",
                  color: "var(--shbz-text-strong)"
                }}
              >
                Решено {assignment.solvedCount}/{assignment.totalNumbers}
              </span>
              <span
                className="rounded-[8px] border px-3.5 py-1.5 text-sm font-bold"
                style={{
                  borderColor: "var(--shbz-outline-border)",
                  background: "var(--shbz-card-bg)",
                  color: "var(--shbz-text-strong)"
                }}
              >
                Красные <span style={{ color: "var(--shbz-danger-text)" }}>{assignment.redCount}</span>
              </span>
              <span
                className="rounded-[8px] border px-3.5 py-1.5 text-sm font-bold"
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
                        loading="lazy"
                        alt={photo.originalName}
                        className="h-16 w-16 rounded-[12px] border object-cover transition hover:opacity-80"
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

            {latestDone && latestDone.results.some((result) => result.verdict !== "UNCERTAIN") ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void acceptAiVerdicts(assignment)}
                  className="shbz-btn-outline"
                >
                  Принять вердикты ИИ
                </button>
                <span className="ml-2.5 text-xs" style={{ color: "var(--shbz-kicker)" }}>
                  Верно → Зеленый, Ошибка → Красный; «на проверке» не трогаем.
                </span>
              </div>
            ) : null}

            <p className="ui-kicker mt-5">Номера</p>
            <div className="mt-2.5 space-y-2.5">
              {assignment.numbers.map((number) => {
                const ai = aiByNumber.get(number.number) ?? null;
                const aiMeta = ai ? verdictMeta[ai.verdict] : null;
                const showAnswer = Boolean(ai && ai.verdict !== "UNCERTAIN" && ai.recognizedAnswer);
                const currentStatus = effectiveStatus(number.homeworkNumberId, number.status);

                return (
                  <div
                    key={number.homeworkNumberId}
                    className="teacher-number-card rounded-[16px] border border-l-[3px] px-4 py-3.5"
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
                          <HomeworkStatusBadge status={currentStatus} />
                        </div>

                        {showAnswer && ai ? (
                          <p className="ui-copy-muted mt-1.5 text-sm" title={ai.recognizedAnswer ?? undefined}>
                            Распознано: {shortenRecognizedAnswer(ai.recognizedAnswer ?? "")}
                          </p>
                        ) : null}
                        {ai?.comment ? <p className="ui-copy-muted mt-1 text-sm leading-6">{ai.comment}</p> : null}
                        {!lessonMode && ai && (ai.copySuspected || ai.injectionSuspected) ? (
                          <details className="mt-2 rounded-[8px]" style={{ background: "var(--shbz-tab-hover)" }}>
                            <summary
                              className="cursor-pointer list-none px-3 py-1.5 text-xs font-bold [&::-webkit-details-marker]:hidden"
                              style={{ color: "var(--shbz-kicker)" }}
                            >
                              Служебная диагностика · видно только вам
                            </summary>
                            <div className="space-y-1 px-3 pb-2 text-xs leading-5" style={{ color: "var(--shbz-text-muted)" }}>
                              {ai.copySuspected ? (
                                <p>Похоже на списанное{ai.copyReason ? `: ${ai.copyReason}` : "."}</p>
                              ) : null}
                              {ai.injectionSuspected ? (
                                <p>Надпись-инструкция на фото{ai.injectionNote ? `: ${ai.injectionNote}` : "."}</p>
                              ) : null}
                            </div>
                          </details>
                        ) : null}
                        {number.note ? (
                          <div className="ui-card-soft mt-2 rounded-[12px] px-3 py-1.5">
                            <p className="whitespace-pre-line text-sm leading-6 text-[var(--theme-text-default)]">{number.note}</p>
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="flex flex-none flex-wrap items-center gap-1.5"
                        data-status-group
                        onKeyDown={(event) =>
                          handleStatusGroupKeyDown(event, number.homeworkNumberId, number.status)
                        }
                      >
                        {statusOptions.map((option, optionIndex) => {
                          const meta = homeworkStatusMeta[option];
                          const isActive = currentStatus === option;

                          return (
                            <button
                              key={option}
                              type="button"
                              aria-pressed={isActive}
                              // Roving tabindex: Tab входит в тройку один раз, внутри — стрелки.
                              tabIndex={optionIndex === 0 ? 0 : -1}
                              disabled={savingStatusId === number.homeworkNumberId}
                              onClick={() =>
                                void setNumberStatus(
                                  number.homeworkNumberId,
                                  isActive ? null : option,
                                  currentStatus
                                )
                              }
                              className={cx(
                                "ui-pressable rounded-[12px] px-3.5 py-2 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
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
              <details className="group mt-5 rounded-[16px] border" style={{ borderColor: "var(--shbz-soft-border)" }}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="text-[15px] font-bold text-[var(--theme-text-strong)]">История проверок</span>
                  <span className="ui-copy-muted text-sm">· {pluralizeRuns(assignment.checks.length)}</span>
                  <svg
                    className="ml-auto h-3.5 w-3.5 transition-transform duration-[180ms] ease-[var(--ease-in-out)] group-open:rotate-180"
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
                                className="rounded-[8px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
                                style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
                              >
                                Текущая
                              </span>
                            ) : null}
                            {check.status === "FAILED" ? (
                              <span
                                className="rounded-[8px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
                                style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}
                              >
                                Сбой
                              </span>
                            ) : null}
                            {isRunning ? (
                              <span
                                className="rounded-[8px] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.8px]"
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
                                  className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-[12px] px-2 py-2 transition hover:bg-[var(--shbz-tab-hover)] [&::-webkit-details-marker]:hidden"
                                  title="Показать вердикты по номерам"
                                >
                                  {headerRow}
                                </summary>
                                {check.photos.length > 0 ? (
                                  <div className="px-2 pt-1">
                                    <p className="ui-kicker mb-1.5">Фото этой попытки</p>
                                    <div className="flex flex-wrap gap-2">
                                      {check.photos.map((photo) => (
                                        <a
                                          key={photo.fileId}
                                          href={`/files/${photo.fileId}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={photo.originalName}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={`/files/${photo.fileId}`}
                                            loading="lazy"
                                            alt={photo.originalName}
                                            className="h-14 w-14 rounded-[12px] border object-cover transition hover:opacity-80"
                                            style={{ borderColor: "var(--shbz-soft-border)" }}
                                          />
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
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
  };

  return (
    <div className="space-y-4">
      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      {hasDiagnostics ? (
        <div className="flex justify-end">
          <button
            type="button"
            aria-pressed={lessonMode}
            onClick={() => setLessonMode((value) => !value)}
            className="shbz-btn-outline"
          >
            {lessonMode ? "Показать служебную диагностику" : "Скрыть диагностику на время урока"}
          </button>
        </div>
      ) : null}

      {activeAssignments.map((assignment) => renderAssignmentCard(assignment))}

      {completedAssignments.length > 0 ? (
        <details className="group pt-2">
          <summary
            className="ui-pressable inline-flex cursor-pointer list-none items-center gap-2 rounded-[12px] px-5 py-2.5 text-sm font-bold [&::-webkit-details-marker]:hidden"
            style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}
          >
            Выполненные ДЗ ({completedAssignments.length})
            <svg
              className="h-3.5 w-3.5 transition-transform duration-[180ms] ease-[var(--ease-in-out)] group-open:rotate-180"
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
            {completedAssignments.map((assignment) => renderAssignmentCard(assignment))}
          </div>
        </details>
      ) : null}

      {acceptUndo ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-[12px] border px-4 py-3 text-sm font-semibold shadow-lg"
          style={{
            background: "var(--shbz-card-bg)",
            borderColor: "var(--shbz-card-border)",
            color: "var(--shbz-text-strong)"
          }}
        >
          {acceptUndo.label}
          <button
            type="button"
            className="font-bold underline"
            style={{ color: "var(--shbz-accent-solid)" }}
            onClick={() => void undoAcceptAiVerdicts()}
          >
            Отменить
          </button>
        </div>
      ) : null}
    </div>
  );
}
