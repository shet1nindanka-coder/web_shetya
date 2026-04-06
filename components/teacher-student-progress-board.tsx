"use client";

import Link from "next/link";
import { HomeworkNumberStatus } from "@prisma/client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";

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
  const deadlineLabel = formatDeadlineLabel(number.studentStatus?.deadlineAt ?? null);

  return (
    <div className="teacher-number-card rounded-[24px] border px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <label className="ui-copy-muted inline-flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={number.selectedForBulk}
            onChange={() => onToggleBulkSelection(topicId, number.id)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Выбрать
        </label>
        <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="teacher-number-title text-lg font-semibold text-[var(--theme-text-strong)]">№ {number.number}</p>
        {homeworkLabel ? <Badge className="border-brand-200 bg-brand-50 text-brand-700">{homeworkLabel}</Badge> : null}
      </div>
      {number.studentStatus?.note ? (
        <div className="ui-card-soft mt-3 rounded-2xl px-3 py-2">
          <p className="text-sm leading-6 text-[var(--theme-text-default)]">{number.studentStatus.note}</p>
        </div>
      ) : null}
      <div className="teacher-deadline-panel mt-3 rounded-2xl border px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="ui-copy-muted text-sm font-medium">Дедлайн</p>
          {number.isSavingDeadline ? <span className="ui-copy-soft text-xs">Сохраняем...</span> : null}
        </div>
        <input
          type="datetime-local"
          value={number.deadlineInputValue}
          disabled={!deadlinesEnabled}
          onChange={(event) => onUpdateDeadlineValue(topicId, number.id, event.target.value)}
          onBlur={() => onFlushDeadline(topicId, number.id)}
          className="ui-input mt-2 w-full rounded-2xl px-3 py-2 text-sm"
        />
        <p className="ui-copy-muted mt-2 text-xs leading-5">
          {deadlineLabel ? `Назначен до ${deadlineLabel}` : "Дедлайн пока не назначен."}
        </p>
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
    <article className="teacher-topic-card rounded-[28px] border p-5">
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
            <span>Красные: <span className="font-semibold text-rose-700">{topic.redCount}</span></span>
            {homeworkGroups.length > 0 ? (
              <span>ДЗ: <span className="font-semibold text-[var(--theme-text-strong)]">{homeworkGroups.length}</span></span>
            ) : null}
            {isCompleted ? <span className="font-medium text-emerald-700">Тема завершена</span> : null}
          </div>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="ui-surface space-y-2 rounded-[24px] border p-4">
            <div className="ui-copy-muted flex items-center justify-between text-sm">
              <span>Решено по теме</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">{topic.solvedPercent}%</span>
            </div>
            <ProgressBar value={topic.solvedPercent} />
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/teacher/topics/${topic.id}`}
              className="ui-pressable ui-button-secondary inline-flex rounded-[14px] px-4 py-2 text-sm font-semibold transition"
            >
              Открыть тему
            </Link>
          </div>
        </div>
      </div>

      <div className="teacher-bulk-deadline-panel mt-5 rounded-[24px] border px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="ui-copy-muted text-sm font-medium">Выдать ДЗ</p>
            <p className="ui-copy-muted mt-2 text-sm leading-6">Выберите несколько номеров ниже и выдайте их как одно ДЗ с общим дедлайном.</p>
          </div>
          <span className="ui-copy-muted text-sm">Выбрано: <span className="font-semibold text-[var(--theme-text-strong)]">{selectedCount}</span></span>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="datetime-local"
            value={topic.bulkDeadlineInputValue}
            disabled={!deadlinesEnabled || topic.isSavingBulk}
            onChange={(event) => onUpdateBulkDeadlineValue(topic.id, event.target.value)}
            className="ui-input w-full rounded-2xl px-3 py-3 text-sm lg:max-w-xs"
          />
          <button
            type="button"
            disabled={!deadlinesEnabled || !selectedCount || topic.isSavingBulk}
            onClick={() => onApplyBulkDeadline(topic.id)}
            className="ui-pressable ui-button-primary rounded-[16px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {topic.isSavingBulk ? "Выдаем..." : "Выдать ДЗ"}
          </button>
          <button
            type="button"
            disabled={!selectedCount || topic.isSavingBulk}
            onClick={() => onClearBulkSelection(topic.id)}
            className="ui-pressable ui-button-secondary rounded-[16px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Снять выбор
          </button>
        </div>

        {homeworkGroups.length > 0 ? (
          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/70 px-3 py-3">
            <p className="text-sm font-medium text-slate-500">Выданные ДЗ</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {homeworkGroups.map((group) => (
                <Badge key={group.id} className="border-slate-200 bg-white text-slate-700">
                  {group.label} · {group.count}
                  {group.deadlineLabel ? ` · ${group.deadlineLabel}` : ""}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {isCompleted ? (
        <details className="mt-5 rounded-[20px] border border-emerald-200 bg-emerald-50/70">
          <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-semibold text-emerald-900">Тема полностью решена</p>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                Все номера уже отмечены зеленым или желтым. Подробности можно открыть при необходимости.
              </p>
            </div>
            <span className="rounded-[12px] border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
              Показать номера
            </span>
          </summary>
          <div className="border-t border-emerald-100 px-4 py-4">{numberCards}</div>
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestVersionRef = useRef<Record<string, number>>({});
  const controllersRef = useRef<Record<string, AbortController | undefined>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

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

  return (
    <div className="space-y-5">
      {!deadlinesEnabled ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Дедлайны появятся здесь после обновления базы данных до актуальной версии.
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {saveError}
        </div>
      ) : null}

      {topics.map((topic) => (
        <TeacherTopicCard
          key={topic.id}
          topic={topic}
          deadlinesEnabled={deadlinesEnabled}
          onApplyBulkDeadline={applyBulkDeadline}
          onClearBulkSelection={clearBulkSelection}
          onToggleBulkSelection={toggleBulkSelection}
          onUpdateBulkDeadlineValue={updateBulkDeadlineValue}
          onUpdateDeadlineValue={updateDeadlineValue}
          onFlushDeadline={flushDeadline}
        />
      ))}
    </div>
  );
}
