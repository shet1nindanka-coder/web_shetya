"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { completionPercent, cx, getStatusCounts, homeworkStatusMeta } from "@/lib/utils";

type StudentTopicStatusBoardProps = {
  topicId: string;
  totalNumbers: number;
  initialNumbers: Array<{
    id: string;
    number: number;
    status: HomeworkNumberStatus | null;
  }>;
};

type StudentNumberState = {
  id: string;
  number: number;
  status: HomeworkNumberStatus | null;
  isSaving: boolean;
};

type StudentNumberCardProps = {
  number: StudentNumberState;
  onSelect: (homeworkNumberId: string, status: HomeworkNumberStatus | null) => void;
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

const statusOptions = [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED] as const;

const StudentNumberCard = memo(function StudentNumberCard({ number, onSelect }: StudentNumberCardProps) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Домашнее задание</p>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-2xl font-semibold text-slate-950">№ {number.number}</h3>
            <HomeworkStatusBadge status={number.status} />
            {number.isSaving ? <span className="text-xs font-medium text-slate-500">Сохраняем...</span> : null}
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
                  "min-w-[190px] touch-manipulation rounded-[22px] border px-4 py-4 text-left text-sm transition-colors duration-75",
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
    </div>
  );
});

export function StudentTopicStatusBoard({
  topicId,
  totalNumbers,
  initialNumbers
}: StudentTopicStatusBoardProps) {
  const initialState = useMemo<StudentNumberState[]>(
    () =>
      initialNumbers.map((number) => ({
        ...number,
        isSaving: false
      })),
    [initialNumbers]
  );
  const numbersRef = useRef<StudentNumberState[]>(initialState);
  const [numbers, setNumbers] = useState<StudentNumberState[]>(initialState);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestVersionRef = useRef<Record<string, number>>({});
  const controllersRef = useRef<Record<string, AbortController | undefined>>({});

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
    const activeControllers = controllersRef.current;

    return () => {
      for (const controller of Object.values(activeControllers)) {
        controller?.abort();
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

  const savingCount = numbers.filter((number) => number.isSaving).length;

  const updateNumberStatus = useCallback(async (homeworkNumberId: string, nextStatus: HomeworkNumberStatus | null) => {
    const currentNumber = numbersRef.current.find((number) => number.id === homeworkNumberId);

    if (!currentNumber || currentNumber.status === nextStatus) {
      return;
    }

    setSaveError(null);

    const previousStatus = currentNumber.status;
    const nextVersion = (requestVersionRef.current[homeworkNumberId] ?? 0) + 1;
    requestVersionRef.current[homeworkNumberId] = nextVersion;

    controllersRef.current[homeworkNumberId]?.abort();

    const controller = new AbortController();
    controllersRef.current[homeworkNumberId] = controller;

    updateNumbersState((current) =>
      current.map((number) =>
        number.id === homeworkNumberId
          ? {
              ...number,
              status: nextStatus,
              isSaving: true
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

      if (requestVersionRef.current[homeworkNumberId] !== nextVersion) {
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
                isSaving: false
              }
            : number
        )
      );
    } catch (error) {
      if (controller.signal.aborted || requestVersionRef.current[homeworkNumberId] !== nextVersion) {
        return;
      }

      updateNumbersState((current) =>
        current.map((number) =>
          number.id === homeworkNumberId
            ? {
                ...number,
                status: previousStatus,
                isSaving: false
              }
            : number
        )
      );

      setSaveError(error instanceof Error ? error.message : "Сохранение не удалось. Попробуйте ещё раз.");
    } finally {
      if (requestVersionRef.current[homeworkNumberId] === nextVersion) {
        delete controllersRef.current[homeworkNumberId];
      }
    }
  }, [topicId, updateNumbersState]);

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
        <StatCard label="Номера" value={totalNumbers} hint="Всего номеров в домашнем задании этой темы." />
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
        description="Выберите цвет для каждого номера: зеленый, желтый или красный. Повторный клик по активному цвету снимет статус, если номер был отмечен случайно."
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
            <StudentNumberCard key={number.id} number={number} onSelect={updateNumberStatus} />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
