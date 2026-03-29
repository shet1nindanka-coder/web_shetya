"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { completionPercent, cx, getStatusCounts, homeworkStatusMeta } from "@/lib/utils";

type StudentTopicStatusBoardProps = {
  topicId: string;
  totalNumbers: number;
  notesEnabled: boolean;
  initialNumbers: Array<{
    id: string;
    number: number;
    status: HomeworkNumberStatus | null;
    note: string;
    answerLatex: string | null;
  }>;
};

type StudentNumberState = {
  id: string;
  number: number;
  status: HomeworkNumberStatus | null;
  note: string;
  savedNote: string;
  answerLatex: string | null;
  isSavingStatus: boolean;
  isSavingNote: boolean;
};

type StudentNumberCardProps = {
  number: StudentNumberState;
  notesEnabled: boolean;
  onSelect: (homeworkNumberId: string, status: HomeworkNumberStatus | null) => void;
  onNoteChange: (homeworkNumberId: string, value: string) => void;
  onNoteBlur: (homeworkNumberId: string) => void;
};

function getStatusSaveErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  if (status === 400) {
    return "Не удалось сохранить выбранный статус.";
  }

  return "Сохранение не удалось. Попробуйте ещё раз.";
}

function getNoteSaveErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  if (status === 400) {
    return "Не удалось сохранить заметку.";
  }

  return "Заметка не сохранилась. Попробуйте ещё раз.";
}

const statusOptions = [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED] as const;

const StudentNumberCard = memo(function StudentNumberCard({
  number,
  notesEnabled,
  onSelect,
  onNoteChange,
  onNoteBlur
}: StudentNumberCardProps) {
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const isSaving = number.isSavingStatus || number.isSavingNote;

  return (
    <div className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Задания</p>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-2xl font-semibold text-slate-950">№ {number.number}</h3>
            <HomeworkStatusBadge status={number.status} />
            {isSaving ? <span className="text-xs font-medium text-slate-500">Сохраняем...</span> : null}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {statusOptions.map((status) => {
            const isActive = number.status === status;
            const meta = homeworkStatusMeta[status];

            return (
              <button
                key={status}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect(number.id, isActive ? null : status)}
                className={cx(
                  "ui-pressable min-w-[190px] touch-manipulation rounded-[22px] border px-4 py-4 text-left text-sm transition-colors duration-75",
                  isActive
                    ? meta.cardClassName
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                )}
              >
                <p className="font-semibold">{meta.shortLabel}</p>
                <p className="mt-2 leading-6">{meta.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {notesEnabled ? (
        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Личная заметка</p>
            <span className="text-xs text-slate-400">{number.note.length}/240</span>
          </div>
          <textarea
            rows={2}
            maxLength={240}
            value={number.note}
            onChange={(event) => onNoteChange(number.id, event.target.value)}
            onBlur={() => onNoteBlur(number.id)}
            placeholder="Короткая заметка к этому номеру"
            className="mt-3 min-h-[72px] w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:bg-white"
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">Сохранится автоматически и останется у вас в теме.</p>
        </div>
      ) : null}

      {number.answerLatex ? (
        <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ответ к номеру</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Нажмите на карточку, чтобы {isAnswerVisible ? "снова скрыть" : "посмотреть"} ответ преподавателя.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAnswerVisible((current) => !current)}
              className="ui-pressable rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {isAnswerVisible ? "Скрыть ответ" : "Открыть ответ"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAnswerVisible((current) => !current)}
            className="ui-pressable group mt-3 block w-full overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 text-left"
          >
            <div className="relative overflow-hidden rounded-[20px] bg-white">
              <div
                className={cx(
                  "px-4 py-4 transition duration-300",
                  !isAnswerVisible && "select-none blur-sm scale-[1.01]"
                )}
              >
                <LatexAnswerPreview value={number.answerLatex} />
              </div>

              {!isAnswerVisible ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/10 px-4 text-center">
                  <span className="rounded-full border border-white/70 bg-white px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm">
                    Нажмите, чтобы посмотреть ответ
                  </span>
                </div>
              ) : null}
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
});

export function StudentTopicStatusBoard({
  topicId,
  totalNumbers,
  notesEnabled,
  initialNumbers
}: StudentTopicStatusBoardProps) {
  const initialState = useMemo<StudentNumberState[]>(
    () =>
      initialNumbers.map((number) => ({
        ...number,
        savedNote: number.note,
        isSavingStatus: false,
        isSavingNote: false
      })),
    [initialNumbers]
  );
  const numbersRef = useRef<StudentNumberState[]>(initialState);
  const [numbers, setNumbers] = useState<StudentNumberState[]>(initialState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const statusRequestVersionRef = useRef<Record<string, number>>({});
  const noteRequestVersionRef = useRef<Record<string, number>>({});
  const statusControllersRef = useRef<Record<string, AbortController | undefined>>({});
  const noteControllersRef = useRef<Record<string, AbortController | undefined>>({});
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const updateNumbersState = useCallback((updater: (current: StudentNumberState[]) => StudentNumberState[]) => {
    setNumbers((current) => {
      const next = updater(current);
      numbersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    numbersRef.current = initialState;
    setNumbers(initialState);
  }, [initialState]);

  useEffect(() => {
    const activeStatusControllers = statusControllersRef.current;
    const activeNoteControllers = noteControllersRef.current;
    const noteTimers = noteTimersRef.current;

    return () => {
      for (const controller of Object.values(activeStatusControllers)) {
        controller?.abort();
      }

      for (const controller of Object.values(activeNoteControllers)) {
        controller?.abort();
      }

      for (const timeoutId of Object.values(noteTimers)) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
  }, []);

  const summary = useMemo(() => {
    const counts = getStatusCounts(numbers.map((number) => number.status));
    const markedCount = counts.GREEN + counts.YELLOW + counts.RED;

    return {
      greenCount: counts.GREEN,
      yellowCount: counts.YELLOW,
      redCount: counts.RED,
      markedCount,
      progressPercent: completionPercent(markedCount, totalNumbers)
    };
  }, [numbers, totalNumbers]);

  const savingCount = numbers.filter((number) => number.isSavingStatus || number.isSavingNote).length;

  const updateNumberStatus = useCallback(async (homeworkNumberId: string, nextStatus: HomeworkNumberStatus | null) => {
    const currentNumber = numbersRef.current.find((number) => number.id === homeworkNumberId);

    if (!currentNumber || currentNumber.status === nextStatus) {
      return;
    }

    setSaveError(null);

    const previousStatus = currentNumber.status;
    const nextVersion = (statusRequestVersionRef.current[homeworkNumberId] ?? 0) + 1;
    statusRequestVersionRef.current[homeworkNumberId] = nextVersion;

    statusControllersRef.current[homeworkNumberId]?.abort();

    const controller = new AbortController();
    statusControllersRef.current[homeworkNumberId] = controller;

    updateNumbersState((current) =>
      current.map((number) =>
        number.id === homeworkNumberId
          ? {
              ...number,
              status: nextStatus,
              isSavingStatus: true
            }
          : number
      )
    );

    try {
      const response = await fetch("/api/student/topic-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topicId,
          homeworkNumberId,
          status: nextStatus
        }),
        signal: controller.signal
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (statusRequestVersionRef.current[homeworkNumberId] !== nextVersion) {
        return;
      }

      if (!response.ok) {
        throw new Error(result?.error || getStatusSaveErrorMessage(response.status));
      }

      updateNumbersState((current) =>
        current.map((number) =>
          number.id === homeworkNumberId
            ? {
                ...number,
                isSavingStatus: false
              }
            : number
        )
      );
    } catch (error) {
      if (controller.signal.aborted || statusRequestVersionRef.current[homeworkNumberId] !== nextVersion) {
        return;
      }

      updateNumbersState((current) =>
        current.map((number) =>
          number.id === homeworkNumberId
            ? {
                ...number,
                status: previousStatus,
                isSavingStatus: false
              }
            : number
        )
      );

      setSaveError(error instanceof Error ? error.message : "Сохранение не удалось. Попробуйте ещё раз.");
    } finally {
      if (statusRequestVersionRef.current[homeworkNumberId] === nextVersion) {
        delete statusControllersRef.current[homeworkNumberId];
      }
    }
  }, [topicId, updateNumbersState]);

  const saveNumberNote = useCallback(
    async (homeworkNumberId: string, nextDraft?: string) => {
      const currentNumber = numbersRef.current.find((number) => number.id === homeworkNumberId);

      if (!currentNumber) {
        return;
      }

      const rawDraftNote = nextDraft ?? currentNumber.note;
      const draftNote = rawDraftNote.trim();
      const savedNote = currentNumber.savedNote.trim();

      if (draftNote === savedNote) {
        if (currentNumber.note !== currentNumber.savedNote) {
          updateNumbersState((current) =>
            current.map((number) =>
              number.id === homeworkNumberId
                ? {
                    ...number,
                    note: currentNumber.savedNote
                  }
                : number
            )
          );
        }

        return;
      }

      setSaveError(null);

      const nextVersion = (noteRequestVersionRef.current[homeworkNumberId] ?? 0) + 1;
      noteRequestVersionRef.current[homeworkNumberId] = nextVersion;

      noteControllersRef.current[homeworkNumberId]?.abort();

      const controller = new AbortController();
      noteControllersRef.current[homeworkNumberId] = controller;

      updateNumbersState((current) =>
        current.map((number) =>
          number.id === homeworkNumberId
            ? {
                ...number,
                isSavingNote: true
              }
            : number
        )
      );

      try {
        const response = await fetch("/api/student/topic-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            topicId,
            homeworkNumberId,
            note: nextDraft ?? currentNumber.note
          }),
          signal: controller.signal
        });

        const result = (await response.json().catch(() => null)) as { error?: string; note?: string } | null;

        if (noteRequestVersionRef.current[homeworkNumberId] !== nextVersion) {
          return;
        }

        if (!response.ok) {
          throw new Error(result?.error || getNoteSaveErrorMessage(response.status));
        }

        const savedValue = typeof result?.note === "string" ? result.note : draftNote;

        updateNumbersState((current) =>
          current.map((number) =>
            number.id === homeworkNumberId
              ? {
                  ...number,
                  note: savedValue,
                  savedNote: savedValue,
                  isSavingNote: false
                }
              : number
          )
        );
      } catch (error) {
        if (controller.signal.aborted || noteRequestVersionRef.current[homeworkNumberId] !== nextVersion) {
          return;
        }

        updateNumbersState((current) =>
          current.map((number) =>
            number.id === homeworkNumberId
              ? {
                  ...number,
                  isSavingNote: false
                }
              : number
        )
      );

      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить заметку. Попробуйте ещё раз.");
      } finally {
        if (noteRequestVersionRef.current[homeworkNumberId] === nextVersion) {
          delete noteControllersRef.current[homeworkNumberId];
        }
      }
    },
    [topicId, updateNumbersState]
  );

  const updateNumberNote = useCallback(
    (homeworkNumberId: string, value: string) => {
      setSaveError(null);

      updateNumbersState((current) =>
        current.map((number) =>
          number.id === homeworkNumberId
            ? {
                ...number,
                note: value
              }
            : number
        )
      );

      const existingTimer = noteTimersRef.current[homeworkNumberId];

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      noteTimersRef.current[homeworkNumberId] = setTimeout(() => {
        void saveNumberNote(homeworkNumberId, value);
      }, 650);
    },
    [saveNumberNote, updateNumbersState]
  );

  const flushNumberNote = useCallback(
    (homeworkNumberId: string) => {
      const existingTimer = noteTimersRef.current[homeworkNumberId];

      if (existingTimer) {
        clearTimeout(existingTimer);
        delete noteTimersRef.current[homeworkNumberId];
      }

      void saveNumberNote(homeworkNumberId);
    },
    [saveNumberNote]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Badge className="border-slate-200 bg-white text-slate-700">Номеров {totalNumbers}</Badge>
        <Badge className="border-slate-200 bg-white text-slate-700">
          Отмечено {summary.markedCount} из {totalNumbers}
        </Badge>
        <Badge className="border-slate-200 bg-white text-slate-700">Прогресс {summary.progressPercent}%</Badge>
        {savingCount > 0 ? (
          <Badge className="border-brand-200 bg-brand-50 text-brand-700">Сохраняем: {savingCount}</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Номера" value={totalNumbers} hint="Всего номеров в заданиях этой темы." />
        <StatCard label="Зеленые" value={summary.greenCount} hint="Решены сразу и правильно." />
        <StatCard label="Желтые" value={summary.yellowCount} hint="Исправлены после самопроверки." />
        <StatCard label="Красные" value={summary.redCount} hint="Нужна помощь преподавателя." />
      </div>

      <SectionCard
        title="Общий прогресс по теме"
        description="Чем больше номеров вы отметили, тем точнее преподаватель видит ваш текущий уровень по теме."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Отмечено номеров</span>
            <span className="font-semibold text-slate-950">
              {summary.markedCount} / {totalNumbers}
            </span>
          </div>
          <ProgressBar value={summary.progressPercent} />
        </div>
      </SectionCard>

      <SectionCard
        title="Статусы номеров"
        description={
          notesEnabled
            ? "Выберите цвет для каждого номера: зеленый, желтый или красный. Ниже можно оставить короткую личную заметку, которая сохранится автоматически."
            : "Выберите цвет для каждого номера: зеленый, желтый или красный. Повторный клик по активному цвету снимет статус."
        }
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.values(HomeworkNumberStatus).map((status) => {
            const meta = homeworkStatusMeta[status];

            return (
              <div
                key={status}
                className={cx(
                  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em]",
                  meta.subtleClassName
                )}
              >
                {meta.shortLabel}
              </div>
            );
          })}
        </div>

        {saveError ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
            {saveError}
          </div>
        ) : null}

        <div className="space-y-4">
          {numbers.map((number) => (
            <StudentNumberCard
              key={number.id}
              number={number}
              notesEnabled={notesEnabled}
              onSelect={updateNumberStatus}
              onNoteChange={updateNumberNote}
              onNoteBlur={flushNumberNote}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
