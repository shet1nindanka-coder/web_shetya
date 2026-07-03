"use client";

import Link from "next/link";
import { HomeworkNumberStatus } from "@prisma/client";
import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ShbzDateTimePicker } from "@/components/shbz-datetime-picker";
import { ProgressBar } from "@/components/progress-bar";
import {
  filterTeacherTopicsByQuery,
  getDefaultTeacherTopicId,
  moveTopicByDirection
} from "@/lib/teacher-topic-selection";

type TeacherStudentProgressBoardProps = {
  studentId: string;
  notesEnabled: boolean;
  deadlinesEnabled: boolean;
  initialTopics: Array<{
    id: string;
    title: string;
    description: string;
    totalNumbers: number;
    solvedCount: number;
    solvedPercent: number;
    markedCount: number;
    redCount: number;
    numbers: Array<{
      id: string;
      number: number;
      studentStatus: {
        status: HomeworkNumberStatus | null;
        note: string;
        deadlineAt: string | null;
      } | null;
    }>;
  }>;
};

type TopicState = TeacherStudentProgressBoardProps["initialTopics"][number];

type TeacherStudentNumberState = TopicState["numbers"][number] & {
  selectedForBulk: boolean;
  deadlineInputValue: string;
  savedDeadlineAt: string | null;
  isSavingDeadline: boolean;
};

type TeacherStudentTopicState = Omit<TopicState, "numbers"> & {
  bulkDeadlineInputValue: string;
  isSavingBulk: boolean;
  numbers: TeacherStudentNumberState[];
};

function formatDeadlineForInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function formatDeadlineLabel(value: string | null) {
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

function inputToIso(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function buildHomeworkGroups(
  numbers: Array<{
    studentStatus: {
      deadlineAt: string | null;
    } | null;
  }>
) {
  const grouped = new Map<string, number>();

  for (const number of numbers) {
    const deadlineAt = number.studentStatus?.deadlineAt;

    if (!deadlineAt) {
      continue;
    }

    grouped.set(deadlineAt, (grouped.get(deadlineAt) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
    .map(([deadlineAt, count], index) => ({
      id: deadlineAt,
      label: `ДЗ ${index + 1}`,
      deadlineAt,
      deadlineLabel: formatDeadlineLabel(deadlineAt),
      count
    }));
}

type TeacherNumberCardProps = {
  topicId: string;
  number: TeacherStudentNumberState;
  deadlinesEnabled: boolean;
  homeworkLabel: string | null;
  onToggleBulkSelection: (topicId: string, homeworkNumberId: string) => void;
  onUpdateDeadlineValue: (topicId: string, homeworkNumberId: string, value: string) => void;
  onFlushDeadline: (topicId: string, homeworkNumberId: string) => void;
};

const TeacherNumberCard = memo(function TeacherNumberCard({
  topicId,
  number,
  deadlinesEnabled,
  homeworkLabel,
  onToggleBulkSelection,
  onUpdateDeadlineValue,
  onFlushDeadline
}: TeacherNumberCardProps) {
  return (
    <div
      role="checkbox"
      aria-checked={number.selectedForBulk}
      tabIndex={0}
      onClick={() => onToggleBulkSelection(topicId, number.id)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onToggleBulkSelection(topicId, number.id);
        }
      }}
      className="teacher-number-card cursor-pointer rounded-[14px] border px-4 py-3.5 transition-[border-color,background,box-shadow]"
      style={{
        borderColor: number.selectedForBulk ? "var(--shbz-accent-solid)" : "var(--shbz-soft-border)",
        background: number.selectedForBulk ? "var(--theme-accent-soft)" : "var(--shbz-soft-bg)",
        boxShadow: number.selectedForBulk ? "0 0 0 1px var(--shbz-accent-solid)" : "none"
      }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-colors"
            style={{
              borderColor: number.selectedForBulk ? "var(--shbz-accent-solid)" : "var(--shbz-outline-border)",
              background: number.selectedForBulk ? "var(--shbz-accent-grad)" : "var(--shbz-card-bg)"
            }}
          >
            {number.selectedForBulk ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
          </span>
          <span className="teacher-number-title truncate text-base font-extrabold text-[var(--theme-text-strong)]">
            № {number.number}
          </span>
          {homeworkLabel ? (
            <Badge className="border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]">
              {homeworkLabel}
            </Badge>
          ) : null}
        </span>
        <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
      </div>
      {number.studentStatus?.note ? (
        <div className="mt-3 rounded-[10px] px-3 py-2" style={{ background: "var(--shbz-card-bg)" }}>
          <p className="text-[13px] leading-5 text-[var(--theme-text-default)]">{number.studentStatus.note}</p>
        </div>
      ) : null}
      <div
        className="mt-3 flex items-center justify-between gap-2"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <ShbzDateTimePicker
          variant="compact"
          value={number.deadlineInputValue}
          disabled={!deadlinesEnabled}
          onChange={(nextValue) => onUpdateDeadlineValue(topicId, number.id, nextValue)}
          onCommit={() => onFlushDeadline(topicId, number.id)}
          placeholder="Назначить дедлайн"
        />
        {number.isSavingDeadline ? <span className="ui-copy-soft shrink-0 text-xs">Сохраняем...</span> : null}
      </div>
    </div>
  );
}, (previousProps, nextProps) =>
  previousProps.topicId === nextProps.topicId &&
  previousProps.deadlinesEnabled === nextProps.deadlinesEnabled &&
  previousProps.homeworkLabel === nextProps.homeworkLabel &&
  previousProps.number === nextProps.number
);

type TeacherTopicCardProps = {
  topic: TeacherStudentTopicState;
  deadlinesEnabled: boolean;
  onApplyBulkDeadline: (topicId: string) => void;
  onClearBulkSelection: (topicId: string) => void;
  onToggleBulkSelection: (topicId: string, homeworkNumberId: string) => void;
  onUpdateBulkDeadlineValue: (topicId: string, value: string) => void;
  onUpdateDeadlineValue: (topicId: string, homeworkNumberId: string, value: string) => void;
  onFlushDeadline: (topicId: string, homeworkNumberId: string) => void;
};

const TeacherTopicCard = memo(function TeacherTopicCard({
  topic,
  deadlinesEnabled,
  onApplyBulkDeadline,
  onClearBulkSelection,
  onToggleBulkSelection,
  onUpdateBulkDeadlineValue,
  onUpdateDeadlineValue,
  onFlushDeadline
}: TeacherTopicCardProps) {
  const isCompleted = topic.totalNumbers > 0 && topic.solvedCount === topic.totalNumbers;
  const selectedCount = topic.numbers.filter((number) => number.selectedForBulk).length;
  const homeworkGroups = useMemo(() => buildHomeworkGroups(topic.numbers), [topic.numbers]);
  const homeworkLabelByDeadline = useMemo(
    () => new Map(homeworkGroups.map((group) => [group.id, group.label])),
    [homeworkGroups]
  );

  const numberCards = (
    <div className="teacher-number-grid mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {topic.numbers.map((number) => (
        <TeacherNumberCard
          key={number.id}
          topicId={topic.id}
          number={number}
          deadlinesEnabled={deadlinesEnabled}
          homeworkLabel={number.studentStatus?.deadlineAt ? (homeworkLabelByDeadline.get(number.studentStatus.deadlineAt) ?? "ДЗ") : null}
          onToggleBulkSelection={onToggleBulkSelection}
          onUpdateDeadlineValue={onUpdateDeadlineValue}
          onFlushDeadline={onFlushDeadline}
        />
      ))}
    </div>
  );

  return (
    <article className="teacher-topic-card rounded-[12px] border p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div>
            <h2 className="teacher-topic-title font-display text-2xl font-semibold text-[var(--theme-text-strong)]">{topic.title}</h2>
            <p className="ui-copy-muted mt-2 text-sm">{topic.totalNumbers} номеров</p>
          </div>
          <p className="ui-copy-muted max-w-3xl text-sm leading-6">{topic.description}</p>
          <div className="ui-copy-muted flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span>Решено: <span className="font-semibold text-[var(--theme-text-strong)]">{topic.solvedCount}/{topic.totalNumbers}</span></span>
            <span>Отмечено: <span className="font-semibold text-[var(--theme-text-strong)]">{topic.markedCount}/{topic.totalNumbers}</span></span>
            <span>Красные: <span className="font-semibold text-[var(--theme-danger-text)]">{topic.redCount}</span></span>
            {homeworkGroups.length > 0 ? (
              <span>ДЗ: <span className="font-semibold text-[var(--theme-text-strong)]">{homeworkGroups.length}</span></span>
            ) : null}
            {isCompleted ? <span className="font-medium text-[var(--theme-success-text)]">Тема завершена</span> : null}
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="ui-panel-soft space-y-2 rounded-[10px] p-4">
            <div className="ui-copy-muted flex items-center justify-between text-sm">
              <span>Решено по теме</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">{topic.solvedPercent}%</span>
            </div>
            <ProgressBar value={topic.solvedPercent} size="sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/teacher/topics/${topic.id}`}
              className="ui-pressable ui-button-secondary inline-flex rounded-[12px] px-4 py-2 text-sm font-semibold transition"
            >
              Открыть тему
            </Link>
          </div>
        </div>
      </div>

      <div className="teacher-bulk-deadline-panel mt-5 rounded-[14px] border px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-[var(--theme-text-strong)]">Выдать ДЗ</p>
          <span
            className="rounded-full px-3 py-1 text-[12.5px] font-bold"
            style={{
              background: selectedCount > 0 ? "var(--theme-accent-soft)" : "var(--shbz-tab-hover)",
              color: selectedCount > 0 ? "var(--shbz-green-text)" : "var(--shbz-kicker)"
            }}
          >
            Выбрано: {selectedCount}
          </span>
          <div className="w-full min-w-[220px] sm:w-auto sm:max-w-[280px] sm:flex-1">
            <ShbzDateTimePicker
              value={topic.bulkDeadlineInputValue}
              disabled={!deadlinesEnabled || topic.isSavingBulk}
              onChange={(nextValue) => onUpdateBulkDeadlineValue(topic.id, nextValue)}
              placeholder="Общий дедлайн"
            />
          </div>
          <button
            type="button"
            disabled={!deadlinesEnabled || !selectedCount || !topic.bulkDeadlineInputValue || topic.isSavingBulk}
            onClick={() => onApplyBulkDeadline(topic.id)}
            className="ui-pressable ui-button-primary rounded-[12px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {topic.isSavingBulk ? "Выдаем..." : "Выдать ДЗ"}
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              disabled={topic.isSavingBulk}
              onClick={() => onClearBulkSelection(topic.id)}
              className="ui-pressable ui-button-secondary rounded-[12px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              Снять выбор
            </button>
          ) : null}
        </div>
        <p className="mt-2.5 text-[13px] leading-5" style={{ color: "var(--shbz-text-muted)" }}>
          1. Кликните по номерам ниже, чтобы выбрать их · 2. Задайте общий дедлайн · 3. Нажмите «Выдать ДЗ».
        </p>

        {homeworkGroups.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--shbz-kicker)" }}>
              Выданные ДЗ:
            </span>
            {homeworkGroups.map((group) => (
              <Badge key={group.id} className="ui-badge-soft">
                {group.label} · {group.count}
                {group.deadlineLabel ? ` · ${group.deadlineLabel}` : ""}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {isCompleted ? (
        <details className="mt-5 rounded-[10px] border border-[var(--theme-success-border)] bg-[var(--theme-success-soft)]">
          <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-semibold text-[var(--theme-success-text)]">Тема полностью решена</p>
              <p className="ui-hint mt-1 text-sm leading-6 text-[var(--theme-success-text)]">
                Все номера уже отмечены зеленым или желтым. Подробности можно открыть при необходимости.
              </p>
            </div>
            <span className="rounded-[12px] border border-[var(--theme-success-border)] bg-[var(--theme-surface-strong)] px-4 py-2 text-sm font-semibold text-[var(--theme-success-text)]">
              Показать номера
            </span>
          </summary>
          <div className="border-t border-[var(--theme-success-border)] px-4 py-4">{numberCards}</div>
        </details>
      ) : (
        numberCards
      )}
    </article>
  );
}, (previousProps, nextProps) =>
  previousProps.deadlinesEnabled === nextProps.deadlinesEnabled &&
  previousProps.topic === nextProps.topic
);

export function TeacherStudentProgressBoard({
  studentId,
  deadlinesEnabled,
  initialTopics
}: TeacherStudentProgressBoardProps) {
  const initialState = useMemo<TeacherStudentTopicState[]>(
    () =>
      initialTopics.map((topic) => ({
        ...topic,
        bulkDeadlineInputValue: "",
        isSavingBulk: false,
        numbers: topic.numbers.map((number) => ({
          ...number,
          selectedForBulk: false,
          deadlineInputValue: formatDeadlineForInput(number.studentStatus?.deadlineAt ?? null),
          savedDeadlineAt: number.studentStatus?.deadlineAt ?? null,
          isSavingDeadline: false
        }))
      })),
    [initialTopics]
  );
  const topicsRef = useRef(initialState);
  const [topics, setTopics] = useState(initialState);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(() => getDefaultTeacherTopicId(initialState));
  const [topicQuery, setTopicQuery] = useState("");
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [orderingTopicId, setOrderingTopicId] = useState<string | null>(null);
  const requestVersionRef = useRef<Record<string, number>>({});
  const controllersRef = useRef<Record<string, AbortController | undefined>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
  const comboboxRef = useRef<HTMLDivElement>(null);
  const topicListboxId = useId();
  const deferredTopicQuery = useDeferredValue(topicQuery);

  const updateTopicsState = useCallback(
    (
      updater: (
        current: TeacherStudentTopicState[]
      ) => TeacherStudentTopicState[]
    ) => {
      setTopics((current) => {
        const next = updater(current);
        topicsRef.current = next;
        return next;
      });
    },
    []
  );

  useEffect(() => {
    topicsRef.current = initialState;
    setTopics(initialState);
    setSelectedTopicId(getDefaultTeacherTopicId(initialState));
    setTopicQuery("");
  }, [initialState]);

  useEffect(() => {
    const controllers = controllersRef.current;
    const timers = timersRef.current;

    return () => {
      for (const controller of Object.values(controllers)) {
        controller?.abort();
      }

      for (const timeoutId of Object.values(timers)) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!comboboxOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxOpen(false);
        setTopicQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [comboboxOpen]);


  const saveDeadline = useCallback(
    async (topicId: string, homeworkNumberId: string, nextDraft?: string) => {
      if (!deadlinesEnabled) {
        return;
      }

      const currentTopic = topicsRef.current.find((topic) => topic.id === topicId);
      const currentNumber = currentTopic?.numbers.find((number) => number.id === homeworkNumberId);

      if (!currentTopic || !currentNumber) {
        return;
      }

      const draftValue = nextDraft ?? currentNumber.deadlineInputValue;
      const nextDeadlineAt = inputToIso(draftValue);
      const savedDeadlineAt = currentNumber.savedDeadlineAt;

      if (nextDeadlineAt === savedDeadlineAt) {
        if (currentNumber.deadlineInputValue !== formatDeadlineForInput(savedDeadlineAt)) {
          updateTopicsState((current) =>
            current.map((topic) =>
              topic.id === topicId
                ? {
                    ...topic,
                    numbers: topic.numbers.map((number) =>
                      number.id === homeworkNumberId
                        ? {
                            ...number,
                            deadlineInputValue: formatDeadlineForInput(savedDeadlineAt)
                          }
                        : number
                    )
                  }
                : topic
            )
          );
        }

        return;
      }

      setSaveError(null);

      const versionKey = `${topicId}:${homeworkNumberId}`;
      const nextVersion = (requestVersionRef.current[versionKey] ?? 0) + 1;
      requestVersionRef.current[versionKey] = nextVersion;

      controllersRef.current[versionKey]?.abort();

      const controller = new AbortController();
      controllersRef.current[versionKey] = controller;

      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                numbers: topic.numbers.map((number) =>
                  number.id === homeworkNumberId
                    ? {
                        ...number,
                        isSavingDeadline: true
                      }
                    : number
                )
              }
            : topic
        )
      );

      try {
        const response = await fetch("/api/teacher/student-deadlines", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            studentId,
            topicId,
            homeworkNumberId,
            deadlineAt: nextDeadlineAt
          }),
          signal: controller.signal
        });

        const result = (await response.json().catch(() => null)) as
          | { error?: string; deadlineAt?: string | null; deadlinesEnabled?: boolean }
          | null;

        if (requestVersionRef.current[versionKey] !== nextVersion) {
          return;
        }

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить дедлайн.");
        }

        const savedValue = typeof result?.deadlineAt === "string" ? result.deadlineAt : null;

        updateTopicsState((current) =>
          current.map((topic) =>
            topic.id === topicId
              ? {
                  ...topic,
                  numbers: topic.numbers.map((number) =>
                    number.id === homeworkNumberId
                      ? {
                          ...number,
                          savedDeadlineAt: savedValue,
                          deadlineInputValue: formatDeadlineForInput(savedValue),
                          isSavingDeadline: false,
                          studentStatus: {
                            status: number.studentStatus?.status ?? null,
                            note: number.studentStatus?.note ?? "",
                            deadlineAt: savedValue
                          }
                        }
                      : number
                  )
                }
              : topic
          )
        );
      } catch (error) {
        if (controller.signal.aborted || requestVersionRef.current[versionKey] !== nextVersion) {
          return;
        }

        updateTopicsState((current) =>
          current.map((topic) =>
            topic.id === topicId
              ? {
                  ...topic,
                  numbers: topic.numbers.map((number) =>
                    number.id === homeworkNumberId
                      ? {
                          ...number,
                          deadlineInputValue: formatDeadlineForInput(number.savedDeadlineAt),
                          isSavingDeadline: false
                        }
                      : number
                  )
                }
              : topic
          )
        );

        setSaveError(error instanceof Error ? error.message : "Не удалось сохранить дедлайн.");
      } finally {
        if (requestVersionRef.current[versionKey] === nextVersion) {
          delete controllersRef.current[versionKey];
        }
      }
    },
    [deadlinesEnabled, studentId, updateTopicsState]
  );

  const updateDeadlineValue = useCallback(
    (topicId: string, homeworkNumberId: string, value: string) => {
      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                numbers: topic.numbers.map((number) =>
                  number.id === homeworkNumberId
                    ? {
                        ...number,
                        deadlineInputValue: value
                      }
                    : number
                )
              }
            : topic
        )
      );

      const key = `${topicId}:${homeworkNumberId}`;
      const existingTimer = timersRef.current[key];

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      timersRef.current[key] = setTimeout(() => {
        void saveDeadline(topicId, homeworkNumberId, value);
      }, 700);
    },
    [saveDeadline, updateTopicsState]
  );

  const flushDeadline = useCallback(
    (topicId: string, homeworkNumberId: string) => {
      const key = `${topicId}:${homeworkNumberId}`;
      const existingTimer = timersRef.current[key];

      if (existingTimer) {
        clearTimeout(existingTimer);
        delete timersRef.current[key];
      }

      void saveDeadline(topicId, homeworkNumberId);
    },
    [saveDeadline]
  );

  const toggleBulkSelection = useCallback(
    (topicId: string, homeworkNumberId: string) => {
      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                numbers: topic.numbers.map((number) =>
                  number.id === homeworkNumberId
                    ? {
                        ...number,
                        selectedForBulk: !number.selectedForBulk
                      }
                    : number
                )
              }
            : topic
        )
      );
    },
    [updateTopicsState]
  );

  const clearBulkSelection = useCallback(
    (topicId: string) => {
      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                numbers: topic.numbers.map((number) => ({
                  ...number,
                  selectedForBulk: false
                }))
              }
            : topic
        )
      );
    },
    [updateTopicsState]
  );

  const updateBulkDeadlineValue = useCallback(
    (topicId: string, value: string) => {
      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                bulkDeadlineInputValue: value
              }
            : topic
        )
      );
    },
    [updateTopicsState]
  );

  const applyBulkDeadline = useCallback(
    async (topicId: string) => {
      if (!deadlinesEnabled) {
        return;
      }

      const currentTopic = topicsRef.current.find((topic) => topic.id === topicId);

      if (!currentTopic) {
        return;
      }

      const selectedNumbers = currentTopic.numbers.filter((number) => number.selectedForBulk);

      if (!selectedNumbers.length) {
        setSaveError("Сначала выберите номера, которым нужно назначить общий дедлайн.");
        return;
      }

      setSaveError(null);

      for (const number of selectedNumbers) {
        const timerKey = `${topicId}:${number.id}`;
        const existingTimer = timersRef.current[timerKey];

        if (existingTimer) {
          clearTimeout(existingTimer);
          delete timersRef.current[timerKey];
        }
      }

      const versionKey = `bulk:${topicId}`;
      const nextVersion = (requestVersionRef.current[versionKey] ?? 0) + 1;
      requestVersionRef.current[versionKey] = nextVersion;

      controllersRef.current[versionKey]?.abort();

      const controller = new AbortController();
      controllersRef.current[versionKey] = controller;
      const nextDeadlineAt = inputToIso(currentTopic.bulkDeadlineInputValue);

      updateTopicsState((current) =>
        current.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                isSavingBulk: true,
                numbers: topic.numbers.map((number) =>
                  number.selectedForBulk
                    ? {
                        ...number,
                        isSavingDeadline: true
                      }
                    : number
                )
              }
            : topic
        )
      );

      try {
        const response = await fetch("/api/teacher/student-deadlines", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            studentId,
            topicId,
            homeworkNumberIds: selectedNumbers.map((number) => number.id),
            deadlineAt: nextDeadlineAt
          }),
          signal: controller.signal
        });

        const result = (await response.json().catch(() => null)) as
          | { error?: string; deadlineAt?: string | null; homeworkNumberIds?: string[] }
          | null;

        if (requestVersionRef.current[versionKey] !== nextVersion) {
          return;
        }

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить общий дедлайн.");
        }

        const savedValue = typeof result?.deadlineAt === "string" ? result.deadlineAt : null;
        const updatedIds = new Set(result?.homeworkNumberIds ?? selectedNumbers.map((number) => number.id));

        updateTopicsState((current) =>
          current.map((topic) =>
            topic.id === topicId
              ? {
                  ...topic,
                  isSavingBulk: false,
                  numbers: topic.numbers.map((number) =>
                    updatedIds.has(number.id)
                      ? {
                          ...number,
                          selectedForBulk: false,
                          savedDeadlineAt: savedValue,
                          deadlineInputValue: formatDeadlineForInput(savedValue),
                          isSavingDeadline: false,
                          studentStatus: {
                            status: number.studentStatus?.status ?? null,
                            note: number.studentStatus?.note ?? "",
                            deadlineAt: savedValue
                          }
                        }
                      : number
                  )
                }
              : topic
          )
        );
      } catch (error) {
        if (controller.signal.aborted || requestVersionRef.current[versionKey] !== nextVersion) {
          return;
        }

        updateTopicsState((current) =>
          current.map((topic) =>
            topic.id === topicId
              ? {
                  ...topic,
                  isSavingBulk: false,
                  numbers: topic.numbers.map((number) =>
                    number.selectedForBulk
                      ? {
                          ...number,
                          isSavingDeadline: false,
                          deadlineInputValue: formatDeadlineForInput(number.savedDeadlineAt)
                        }
                      : number
                  )
                }
              : topic
          )
        );

        setSaveError(error instanceof Error ? error.message : "Не удалось сохранить общий дедлайн.");
      } finally {
        if (requestVersionRef.current[versionKey] === nextVersion) {
          delete controllersRef.current[versionKey];
        }
      }
    },
    [deadlinesEnabled, studentId, updateTopicsState]
  );

  const filteredTopics = useMemo(
    () => filterTeacherTopicsByQuery(topics, deferredTopicQuery),
    [deferredTopicQuery, topics]
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null,
    [selectedTopicId, topics]
  );

  const selectedTopicIndex = useMemo(
    () => (selectedTopic ? topics.findIndex((topic) => topic.id === selectedTopic.id) : -1),
    [selectedTopic, topics]
  );

  const previousTopic = selectedTopicIndex > 0 ? topics[selectedTopicIndex - 1] ?? null : null;
  const nextTopic =
    selectedTopicIndex >= 0 && selectedTopicIndex < topics.length - 1
      ? topics[selectedTopicIndex + 1] ?? null
      : null;

  const selectOptions = useMemo(() => {
    if (!selectedTopic) {
      return filteredTopics;
    }

    if (filteredTopics.some((topic) => topic.id === selectedTopic.id)) {
      return filteredTopics;
    }

    return [selectedTopic, ...filteredTopics];
  }, [filteredTopics, selectedTopic]);

  useEffect(() => {
    if (!topics.length) {
      setSelectedTopicId(null);
      return;
    }

    if (!selectedTopicId || !topics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(getDefaultTeacherTopicId(topics));
    }
  }, [selectedTopicId, topics]);

  useEffect(() => {
    if (!deferredTopicQuery || !filteredTopics.length) {
      return;
    }

    if (!selectedTopicId || !filteredTopics.some((topic) => topic.id === selectedTopicId)) {
      setSelectedTopicId(filteredTopics[0]!.id);
    }
  }, [deferredTopicQuery, filteredTopics, selectedTopicId]);

  const moveSelectedTopic = useCallback(
    async (direction: "up" | "down") => {
      if (!selectedTopicId) {
        return;
      }

      const currentTopics = topicsRef.current;
      const optimisticOrder = moveTopicByDirection(currentTopics, selectedTopicId, direction);

      if (!optimisticOrder.moved) {
        return;
      }

      setSaveError(null);
      setOrderingTopicId(selectedTopicId);
      updateTopicsState(() => optimisticOrder.topics);

      try {
        const response = await fetch("/api/teacher/topics/order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            topicId: selectedTopicId,
            direction
          })
        });

        const result = (await response.json().catch(() => null)) as
          | { error?: string; orderedTopicIds?: string[]; moved?: boolean }
          | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить новый порядок тем.");
        }

        if (Array.isArray(result?.orderedTopicIds) && result.orderedTopicIds.length > 0) {
          const orderByTopicId = new Map(result.orderedTopicIds.map((topicId, index) => [topicId, index]));

          updateTopicsState((current) =>
            [...current].sort(
              (left, right) =>
                (orderByTopicId.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
                (orderByTopicId.get(right.id) ?? Number.MAX_SAFE_INTEGER)
            )
          );
        }
      } catch (error) {
        updateTopicsState(() => currentTopics);
        setSaveError(error instanceof Error ? error.message : "Не удалось сохранить новый порядок тем.");
      } finally {
        setOrderingTopicId(null);
      }
    },
    [selectedTopicId, updateTopicsState]
  );

  return (
    <div className="space-y-5">
      {!deadlinesEnabled ? (
        <div className="ui-notice-warning rounded-[8px] px-4 py-3 text-sm">
          Дедлайны появятся здесь после обновления базы данных до актуальной версии.
        </div>
      ) : null}

      {saveError ? (
        <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">
          {saveError}
        </div>
      ) : null}

      {topics.length > 0 ? (
        <section className="ui-toolbar-shell relative overflow-visible rounded-[10px] p-4 sm:rounded-[12px] sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="relative z-20 min-w-0 flex-1" ref={comboboxRef}>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--theme-text-muted)]">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={comboboxOpen ? topicQuery : (selectedTopic?.title ?? "")}
                  onFocus={() => {
                    setComboboxOpen(true);
                    setTopicQuery("");
                  }}
                  onChange={(event) => setTopicQuery(event.target.value)}
                  placeholder="Найти тему…"
                  className="ui-input h-14 w-full rounded-[8px] pl-10 pr-11 text-sm leading-none"
                  role="combobox"
                  aria-controls={topicListboxId}
                  aria-expanded={comboboxOpen}
                  aria-haspopup="listbox"
                />
                {comboboxOpen && topicQuery ? (
                  <button
                    type="button"
                    onClick={() => setTopicQuery("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--theme-text-muted)] transition hover:text-[var(--theme-text-strong)]"
                    aria-label="Очистить поиск"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-[var(--theme-surface-soft)]">
                      ×
                    </span>
                  </button>
                ) : !comboboxOpen ? (
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-[var(--theme-text-muted)]">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                    </svg>
                  </span>
                ) : null}
              </div>

              {comboboxOpen ? (
                <ul
                  id={topicListboxId}
                  role="listbox"
                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[280px] overflow-y-auto rounded-[10px] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-1.5 shadow-[var(--theme-shadow-hover)] backdrop-blur-sm"
                >
                  {filteredTopics.length === 0 ? (
                    <li className="px-3 py-2.5 text-sm text-[var(--theme-text-muted)]">
                      Ничего не найдено
                    </li>
                  ) : (
                    filteredTopics.map((topic) => (
                      <li key={topic.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={topic.id === selectedTopicId}
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setComboboxOpen(false);
                            setTopicQuery("");
                          }}
                          className={`flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm transition ${
                            topic.id === selectedTopicId
                              ? "bg-[var(--theme-accent-soft)] font-semibold text-[var(--theme-text-strong)]"
                              : "text-[var(--theme-text-default)] hover:bg-[var(--theme-surface-soft)]"
                          }`}
                        >
                          <span className="min-w-0 truncate">{topic.title}</span>
                          <span className="flex-none text-xs text-[var(--theme-text-muted)]">
                            {topic.solvedCount}/{topic.totalNumbers}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-none items-center gap-1.5">
              <span className="hidden text-xs text-[var(--theme-text-muted)] sm:block">
                {topics.length} {topics.length === 1 ? "тема" : topics.length < 5 ? "темы" : "тем"}
              </span>
              <button
                type="button"
                onClick={() => void moveSelectedTopic("up")}
                disabled={selectedTopicIndex <= 0 || orderingTopicId === selectedTopic?.id}
                className="ui-pressable inline-flex h-9 w-9 items-center justify-center rounded-[12px] border text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Переместить тему выше"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void moveSelectedTopic("down")}
                disabled={selectedTopicIndex === -1 || selectedTopicIndex >= topics.length - 1 || orderingTopicId === selectedTopic?.id}
                className="ui-pressable inline-flex h-9 w-9 items-center justify-center rounded-[12px] border text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Переместить тему ниже"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedTopic ? (
        <TeacherTopicCard
          key={selectedTopic.id}
          topic={selectedTopic}
          deadlinesEnabled={deadlinesEnabled}
          onApplyBulkDeadline={applyBulkDeadline}
          onClearBulkSelection={clearBulkSelection}
          onToggleBulkSelection={toggleBulkSelection}
          onUpdateBulkDeadlineValue={updateBulkDeadlineValue}
          onUpdateDeadlineValue={updateDeadlineValue}
          onFlushDeadline={flushDeadline}
        />
      ) : null}
    </div>
  );
}
