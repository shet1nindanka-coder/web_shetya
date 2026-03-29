"use client";

import Link from "next/link";
import { HomeworkNumberStatus } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function TeacherStudentProgressBoard({
  studentId,
  notesEnabled,
  deadlinesEnabled,
  initialTopics
}: TeacherStudentProgressBoardProps) {
  const initialState = useMemo(
    () =>
      initialTopics.map((topic) => ({
        ...topic,
        numbers: topic.numbers.map((number) => ({
          ...number,
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
        current: typeof initialState
      ) => typeof initialState
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

      {topics.map((topic) => {
        const isCompleted = topic.totalNumbers > 0 && topic.solvedCount === topic.totalNumbers;

        return (
          <article key={topic.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Номеров: {topic.totalNumbers}
                  </p>
                  <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">{topic.title}</h2>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{topic.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="border-slate-200 bg-white text-slate-700">
                    Решено {topic.solvedCount}/{topic.totalNumbers}
                  </Badge>
                  <Badge className="border-slate-200 bg-white text-slate-700">
                    Отмечено {topic.markedCount}/{topic.totalNumbers}
                  </Badge>
                  <Badge className="border-slate-200 bg-white text-slate-700">Красные {topic.redCount}</Badge>
                  {isCompleted ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Тема завершена</Badge>
                  ) : null}
                </div>
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="space-y-2 rounded-[24px] border border-white bg-white p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Решено по теме</span>
                    <span className="font-semibold text-slate-950">{topic.solvedPercent}%</span>
                  </div>
                  <ProgressBar value={topic.solvedPercent} />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/teacher/topics/${topic.id}`}
                    className="ui-pressable inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    Открыть тему
                  </Link>
                </div>
              </div>
            </div>

            {isCompleted ? (
              <details className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50/70">
                <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Тема полностью решена</p>
                    <p className="mt-1 text-sm leading-6 text-emerald-800">
                      Все номера уже отмечены зеленым или желтым. Подробности можно открыть при необходимости.
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                    Показать номера
                  </span>
                </summary>

                <div className="border-t border-emerald-100 px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {topic.numbers.map((number) => {
                      const deadlineLabel = formatDeadlineLabel(number.studentStatus?.deadlineAt ?? null);

                      return (
                        <div key={number.id} className="rounded-[24px] border border-white bg-white px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-lg font-semibold text-slate-950">№ {number.number}</p>
                            <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
                          </div>
                          {number.studentStatus?.note ? (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Заметка ученика
                              </p>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{number.studentStatus.note}</p>
                            </div>
                          ) : null}
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                Дедлайн
                              </p>
                              {number.isSavingDeadline ? (
                                <span className="text-xs text-slate-400">Сохраняем...</span>
                              ) : null}
                            </div>
                            <input
                              type="datetime-local"
                              value={number.deadlineInputValue}
                              disabled={!deadlinesEnabled}
                              onChange={(event) => updateDeadlineValue(topic.id, number.id, event.target.value)}
                              onBlur={() => flushDeadline(topic.id, number.id)}
                              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400"
                            />
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              {deadlineLabel ? `Назначен до ${deadlineLabel}` : "Дедлайн пока не назначен."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {topic.numbers.map((number) => {
                  const deadlineLabel = formatDeadlineLabel(number.studentStatus?.deadlineAt ?? null);

                  return (
                    <div key={number.id} className="rounded-[24px] border border-white bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-semibold text-slate-950">№ {number.number}</p>
                        <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
                      </div>
                      {number.studentStatus?.note ? (
                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Заметка ученика
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{number.studentStatus.note}</p>
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Дедлайн
                          </p>
                          {number.isSavingDeadline ? <span className="text-xs text-slate-400">Сохраняем...</span> : null}
                        </div>
                        <input
                          type="datetime-local"
                          value={number.deadlineInputValue}
                          disabled={!deadlinesEnabled}
                          onChange={(event) => updateDeadlineValue(topic.id, number.id, event.target.value)}
                          onBlur={() => flushDeadline(topic.id, number.id)}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400"
                        />
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {deadlineLabel ? `Назначен до ${deadlineLabel}` : "Дедлайн пока не назначен."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
