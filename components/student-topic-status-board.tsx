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
  deadlinesEnabled: boolean;
  initialNumbers: Array<{
    id: string;
    number: number;
    status: HomeworkNumberStatus | null;
    note: string;
    deadlineAt: string | null;
    answerLatex: string | null;
  }>;
};

type StudentNumberState = {
  id: string;
  number: number;
  status: HomeworkNumberStatus | null;
  note: string;
  savedNote: string;
  deadlineAt: string | null;
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

type StudentNumberListProps = {
  numbers: StudentNumberState[];
  notesEnabled: boolean;
  onSelect: (homeworkNumberId: string, status: HomeworkNumberStatus | null) => void;
  onNoteChange: (homeworkNumberId: string, value: string) => void;
  onNoteBlur: (homeworkNumberId: string) => void;
};

type NumberFilterId =
  | "all"
  | "unmarked"
  | "green"
  | "yellow"
  | "red"
  | "deadline"
  | "notes"
  | "answers";

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

const statusOptions = [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED] as const;
const VIRTUALIZATION_THRESHOLD = 12;
const VIRTUAL_OVERSCAN_PX = 960;
const VIRTUAL_ITEM_GAP = 16;

const filterMeta: Record<
  NumberFilterId,
  {
    label: string;
    predicate: (number: StudentNumberState) => boolean;
  }
> = {
  all: {
    label: "Все",
    predicate: () => true
  },
  unmarked: {
    label: "Не отмечены",
    predicate: (number) => number.status === null
  },
  green: {
    label: "Зеленые",
    predicate: (number) => number.status === HomeworkNumberStatus.GREEN
  },
  yellow: {
    label: "Желтые",
    predicate: (number) => number.status === HomeworkNumberStatus.YELLOW
  },
  red: {
    label: "Красные",
    predicate: (number) => number.status === HomeworkNumberStatus.RED
  },
  deadline: {
    label: "С дедлайном",
    predicate: (number) => Boolean(number.deadlineAt)
  },
  notes: {
    label: "С заметкой",
    predicate: (number) => number.note.trim().length > 0
  },
  answers: {
    label: "С ответом",
    predicate: (number) => Boolean(number.answerLatex)
  }
};

function estimateStudentNumberCardHeight(number: StudentNumberState, notesEnabled: boolean) {
  let height = 172;

  if (notesEnabled) {
    height += 146;
  }

  if (number.deadlineAt) {
    height += 88;
  }

  if (number.answerLatex) {
    height += 170;
  }

  return height;
}

function findStartIndex(offsets: number[], scrollOffset: number) {
  let low = 0;
  let high = offsets.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (offsets[mid] <= scrollOffset) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

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
    <div className="student-number-card ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
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

      {number.deadlineAt ? (
        <div className="mt-4 rounded-[24px] border border-brand-100 bg-brand-50/60 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Дедлайн</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Сдать до <span className="font-semibold text-slate-950">{formatDeadlineLabel(number.deadlineAt)}</span>
          </p>
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
              {isAnswerVisible ? (
                <div className="px-4 py-4">
                  <LatexAnswerPreview value={number.answerLatex} />
                </div>
              ) : (
                <div className="student-answer-placeholder min-h-[108px] bg-[linear-gradient(135deg,rgba(241,245,249,0.92),rgba(226,232,240,0.72))]" />
              )}

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
}, (previousProps, nextProps) =>
  previousProps.notesEnabled === nextProps.notesEnabled &&
  previousProps.number === nextProps.number
);

const StudentNumberRow = memo(function StudentNumberRow({
  number,
  top,
  notesEnabled,
  onSelect,
  onNoteChange,
  onNoteBlur,
  onHeightChange
}: StudentNumberCardProps & {
  top: number;
  onHeightChange: (homeworkNumberId: string, height: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = rowRef.current;

    if (!node) {
      return;
    }

    const updateHeight = () => {
      onHeightChange(number.id, Math.ceil(node.getBoundingClientRect().height));
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    resizeObserver.observe(node);

    return () => {
      resizeObserver.disconnect();
    };
  }, [number.id, number, onHeightChange]);

  return (
    <div
      ref={rowRef}
      className="absolute left-0 right-0"
      style={{
        transform: `translateY(${top}px)`
      }}
    >
      <StudentNumberCard
        number={number}
        notesEnabled={notesEnabled}
        onSelect={onSelect}
        onNoteChange={onNoteChange}
        onNoteBlur={onNoteBlur}
      />
    </div>
  );
}, (previousProps, nextProps) =>
  previousProps.top === nextProps.top &&
  previousProps.notesEnabled === nextProps.notesEnabled &&
  previousProps.number === nextProps.number
);

function StudentNumberList({
  numbers,
  notesEnabled,
  onSelect,
  onNoteChange,
  onNoteBlur
}: StudentNumberListProps) {
  const shouldVirtualize = numbers.length > VIRTUALIZATION_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  useEffect(() => {
    const activeIds = new Set(numbers.map((number) => number.id));

    setMeasuredHeights((current) => {
      const nextEntries = Object.entries(current).filter(([key]) => activeIds.has(key));

      if (nextEntries.length === Object.keys(current).length) {
        return current;
      }

      return Object.fromEntries(nextEntries);
    });
  }, [numbers]);

  useEffect(() => {
    if (!shouldVirtualize) {
      return;
    }

    const element = scrollRef.current;

    if (!element) {
      return;
    }

    const syncMetrics = () => {
      setScrollTop(element.scrollTop);
      setViewportHeight(element.clientHeight);
    };

    syncMetrics();
    element.addEventListener("scroll", syncMetrics, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      syncMetrics();
    });

    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", syncMetrics);
      resizeObserver.disconnect();
    };
  }, [shouldVirtualize]);

  const metrics = useMemo(() => {
    let offset = 0;

    const items = numbers.map((number) => {
      const size = measuredHeights[number.id] ?? estimateStudentNumberCardHeight(number, notesEnabled);
      const item = {
        id: number.id,
        size,
        start: offset
      };

      offset += size + VIRTUAL_ITEM_GAP;

      return item;
    });

    return {
      items,
      totalHeight: Math.max(0, offset - VIRTUAL_ITEM_GAP)
    };
  }, [measuredHeights, notesEnabled, numbers]);

  const numbersById = useMemo(() => new Map(numbers.map((number) => [number.id, number])), [numbers]);

  const visibleItems = useMemo(() => {
    if (!shouldVirtualize) {
      return metrics.items;
    }

    const startOffset = Math.max(0, scrollTop - VIRTUAL_OVERSCAN_PX);
    const endOffset = scrollTop + viewportHeight + VIRTUAL_OVERSCAN_PX;
    const starts = metrics.items.map((item) => item.start);
    const startIndex = findStartIndex(starts, startOffset);
    let endIndex = startIndex;

    while (endIndex < metrics.items.length && metrics.items[endIndex]!.start < endOffset) {
      endIndex += 1;
    }

    return metrics.items.slice(startIndex, Math.min(metrics.items.length, endIndex + 1));
  }, [metrics.items, scrollTop, shouldVirtualize, viewportHeight]);

  const handleHeightChange = useCallback((homeworkNumberId: string, nextHeight: number) => {
    setMeasuredHeights((current) => {
      const previousHeight = current[homeworkNumberId];

      if (!nextHeight || previousHeight === nextHeight || Math.abs((previousHeight ?? 0) - nextHeight) < 2) {
        return current;
      }

      return {
        ...current,
        [homeworkNumberId]: nextHeight
      };
    });
  }, []);

  if (!shouldVirtualize) {
    return (
      <div className="student-number-list space-y-4">
        {numbers.map((number) => (
          <StudentNumberCard
            key={number.id}
            number={number}
            notesEnabled={notesEnabled}
            onSelect={onSelect}
            onNoteChange={onNoteChange}
            onNoteBlur={onNoteBlur}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="student-virtual-shell rounded-[28px] border border-slate-200 bg-slate-50/45 p-3">
      <div
        ref={scrollRef}
        className="student-virtual-scroll rounded-[22px]"
        style={{
          maxHeight: "72vh"
        }}
      >
        <div
          style={{
            height: metrics.totalHeight,
            position: "relative"
          }}
        >
          {visibleItems.map((item) => {
            const number = numbersById.get(item.id);

            if (!number) {
              return null;
            }

            return (
              <StudentNumberRow
                key={number.id}
                number={number}
                top={item.start}
                notesEnabled={notesEnabled}
                onSelect={onSelect}
                onNoteChange={onNoteChange}
                onNoteBlur={onNoteBlur}
                onHeightChange={handleHeightChange}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StudentTopicStatusBoard({
  topicId,
  totalNumbers,
  notesEnabled,
  deadlinesEnabled,
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
  const [activeFilter, setActiveFilter] = useState<NumberFilterId>("all");
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
    const solvedCount = counts.GREEN + counts.YELLOW;

    return {
      greenCount: counts.GREEN,
      yellowCount: counts.YELLOW,
      redCount: counts.RED,
      markedCount,
      solvedCount,
      progressPercent: completionPercent(markedCount, totalNumbers)
    };
  }, [numbers, totalNumbers]);

  const savingCount = useMemo(
    () => numbers.filter((number) => number.isSavingStatus || number.isSavingNote).length,
    [numbers]
  );
  const deadlinesCount = useMemo(
    () => numbers.filter((number) => Boolean(number.deadlineAt)).length,
    [numbers]
  );
  const notesCount = useMemo(
    () => numbers.filter((number) => number.note.trim().length > 0).length,
    [numbers]
  );
  const answersCount = useMemo(
    () => numbers.filter((number) => Boolean(number.answerLatex)).length,
    [numbers]
  );
  const availableFilters = useMemo(
    () =>
      (Object.keys(filterMeta) as NumberFilterId[]).filter((filterId) => {
        if (filterId === "notes" && !notesEnabled) {
          return false;
        }

        if (filterId === "deadline" && !deadlinesEnabled) {
          return false;
        }

        if (filterId === "answers" && answersCount === 0) {
          return false;
        }

        return true;
      }),
    [answersCount, deadlinesEnabled, notesEnabled]
  );
  const filteredNumbers = useMemo(() => {
    const filter = filterMeta[activeFilter] ?? filterMeta.all;

    return numbers.filter(filter.predicate);
  }, [activeFilter, numbers]);
  const isTopicCompleted = totalNumbers > 0 && summary.solvedCount === totalNumbers;

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
        {deadlinesEnabled ? (
          <Badge className="border-slate-200 bg-white text-slate-700">Дедлайнов {deadlinesCount}</Badge>
        ) : null}
        {notesEnabled ? <Badge className="border-slate-200 bg-white text-slate-700">Заметок {notesCount}</Badge> : null}
        {answersCount > 0 ? <Badge className="border-slate-200 bg-white text-slate-700">Ответов {answersCount}</Badge> : null}
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
        {deadlinesEnabled && numbers.some((number) => number.deadlineAt) ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Дедлайны по отдельным номерам отображаются прямо внутри карточек ниже.
          </p>
        ) : null}
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

        <div className="mb-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {availableFilters.map((filterId) => {
              const count = numbers.filter(filterMeta[filterId].predicate).length;
              const isActive = activeFilter === filterId;

              return (
                <button
                  key={filterId}
                  type="button"
                  onClick={() => setActiveFilter(filterId)}
                  data-active={isActive}
                  className={cx(
                    "ui-pressable rounded-full border px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "border-brand-200 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.92))] text-brand-700 shadow-[0_12px_24px_rgba(59,130,246,0.14)]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  )}
                >
                  <span>{filterMeta[filterId].label}</span>
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-sm leading-6 text-slate-500">
            Показано {filteredNumbers.length} из {numbers.length} номеров.
          </p>
        </div>

        {isTopicCompleted ? (
          <details className="rounded-[24px] border border-emerald-200 bg-emerald-50/70">
            <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Тема полностью решена</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Все номера уже отмечены зеленым или желтым. Подробности можно открыть в любой момент.
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                Показать номера
              </span>
            </summary>

            <div className="border-t border-emerald-100 px-4 py-4">
              {filteredNumbers.length > 0 ? (
                <StudentNumberList
                  numbers={filteredNumbers}
                  notesEnabled={notesEnabled}
                  onSelect={updateNumberStatus}
                  onNoteChange={updateNumberNote}
                  onNoteBlur={flushNumberNote}
                />
              ) : (
                <div className="rounded-[22px] border border-dashed border-emerald-200 bg-white/70 px-4 py-8 text-center text-sm text-emerald-900">
                  По выбранному фильтру здесь пока ничего нет.
                </div>
              )}
            </div>
          </details>
        ) : (
          <>
            {filteredNumbers.length > 0 ? (
              <StudentNumberList
                numbers={filteredNumbers}
                notesEnabled={notesEnabled}
                onSelect={updateNumberStatus}
                onNoteChange={updateNumberNote}
                onNoteBlur={flushNumberNote}
              />
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                <p className="font-display text-2xl font-semibold text-slate-950">Ничего не найдено</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  По выбранному фильтру пока нет номеров. Попробуйте переключиться на другой.
                </p>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
