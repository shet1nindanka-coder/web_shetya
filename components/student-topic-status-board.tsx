"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { markStudentTopicsNeedsRefresh } from "@/components/student-topics-refresh-bridge";
import { completionPercent, cx, getStatusCounts, homeworkStatusMeta } from "@/lib/utils";

type StudentTopicStatusBoardProps = {
  topicId: string;
  totalNumbers: number;
  notesEnabled: boolean;
  deadlinesEnabled: boolean;
  initialHomeworkFilterId?: string;
  initialNumbers: Array<{
    id: string;
    number: number;
    status: HomeworkNumberStatus | null;
    note: string;
    deadlineAt: string | null;
    conditionLatex: string | null;
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
  conditionLatex: string | null;
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
  resetKey: HomeworkFilterId;
  notesEnabled: boolean;
  homeworkGroupsByDeadline: Map<string, HomeworkGroup>;
  onSelect: (homeworkNumberId: string, status: HomeworkNumberStatus | null) => void;
  onNoteChange: (homeworkNumberId: string, value: string) => void;
  onNoteBlur: (homeworkNumberId: string) => void;
};

type HomeworkFilterId = "all" | string;

type HomeworkGroup = {
  id: string;
  label: string;
  deadlineAt: string;
  deadlineLabel: string | null;
  count: number;
  solvedCount: number;
  isCompleted: boolean;
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
const VIRTUAL_OVERSCAN_PX = 220;
const VIRTUAL_ITEM_GAP = 16;

function estimateStudentNumberCardHeight(number: StudentNumberState, notesEnabled: boolean) {
  let height = 148;

  if (notesEnabled) {
    height += 76;
  }

  if (number.conditionLatex) {
    height += 72;
  }

  if (number.answerLatex) {
    height += 72;
  }

  return height;
}

function getNotePreview(note: string) {
  const trimmed = note.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
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
  homeworkGroup,
  onSelect,
  onNoteChange,
  onNoteBlur
}: StudentNumberCardProps & {
  homeworkGroup: HomeworkGroup | null;
}) {
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const isSaving = number.isSavingStatus || number.isSavingNote;
  const notePreview = getNotePreview(number.note);

  return (
    <div className="student-number-card rounded-[14px] border p-3 sm:rounded-[22px] sm:p-4">
      <div className="student-number-header flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h3 className="student-number-title font-display text-[1.55rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.9rem]">№ {number.number}</h3>
            <HomeworkStatusBadge status={number.status} />
            {homeworkGroup ? (
              <Badge className="border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]">{homeworkGroup.label}</Badge>
            ) : null}
            {isSaving ? <span className="ui-copy-muted text-xs font-medium">Сохраняем...</span> : null}
          </div>
        </div>

        <div className="student-status-grid grid grid-cols-3 gap-1.5 sm:gap-2">
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
                  "ui-pressable w-full touch-manipulation rounded-[12px] px-2.5 py-2 text-center text-[12px] transition-colors duration-75 sm:min-w-[160px] sm:rounded-[16px] sm:px-4 sm:py-3 sm:text-left sm:text-[13px]",
                  isActive
                    ? meta.buttonClassName
                    : "ui-status-button"
                )}
              >
                <p className="font-semibold">{meta.shortLabel}</p>
                <p className="mt-1 hidden leading-5 sm:block">{meta.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {number.conditionLatex ? (
        <div className="student-answer-panel mt-2.5 rounded-[12px] border p-2.5 sm:mt-3 sm:rounded-[20px] sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-kicker">Условие</p>
            </div>
          </div>

          <div className="ui-card-soft mt-2.5 overflow-hidden rounded-[12px] sm:rounded-[18px]">
            <div className="px-3 py-2.5 sm:px-4 sm:py-3.5">
              <LatexAnswerPreview value={number.conditionLatex} />
            </div>
          </div>
        </div>
      ) : null}

      {number.answerLatex ? (
        <div className="student-answer-panel mt-2.5 rounded-[12px] border p-2.5 sm:mt-3 sm:rounded-[20px] sm:p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="ui-kicker">Ответ</p>
            {isAnswerVisible ? (
              <button
                type="button"
                onClick={() => setIsAnswerVisible(false)}
                className="ui-pressable ui-button-secondary w-full rounded-[10px] px-3 py-1.5 text-sm font-semibold transition sm:w-auto sm:rounded-[14px] sm:px-3.5 sm:py-2"
              >
                Скрыть ответ
              </button>
            ) : null}
          </div>

          {isAnswerVisible ? (
            <div className="ui-card-soft mt-2.5 overflow-hidden rounded-[12px] sm:rounded-[18px]">
              <div className="px-3 py-2.5 sm:px-4 sm:py-3.5">
                <LatexAnswerPreview value={number.answerLatex} />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAnswerVisible(true)}
              className="group mt-2.5 block w-full rounded-[12px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:rounded-[18px]"
              aria-expanded={false}
              aria-label={`Открыть ответ к номеру ${number.number}`}
            >
              <div className="ui-card-soft relative overflow-hidden rounded-[12px] border border-dashed sm:rounded-[18px]">
                <div className="pointer-events-none px-3 py-2.5 sm:px-4 sm:py-3.5">
                  <div className="select-none blur-[10px] opacity-80">
                    <LatexAnswerPreview value={number.answerLatex} />
                  </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-[color:color-mix(in_srgb,var(--theme-surface-strong)_62%,transparent)] backdrop-blur-[1px]">
                  <span className="inline-flex items-center rounded-full border border-[var(--theme-accent-border)] bg-[var(--theme-surface-strong)] px-3.5 py-1.5 text-sm font-semibold text-[var(--theme-accent-text)] shadow-[0_10px_28px_rgba(37,99,235,0.12)] transition group-hover:-translate-y-[1px]">
                    Открыть ответ
                  </span>
                </div>
              </div>
            </button>
          )}
        </div>
      ) : null}

      {notesEnabled ? (
        <div className="student-note-panel mt-2.5 rounded-[12px] border px-3 py-2.5 sm:mt-3 sm:rounded-[20px] sm:px-4 sm:py-3">
          <button
            type="button"
            onClick={() => setIsNoteOpen((current) => !current)}
            className="group flex w-full items-center justify-between gap-3 rounded-[10px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-expanded={isNoteOpen}
          >
            <div className="min-w-0 flex-1">
              <p className="ui-kicker">Заметка</p>
              <p
                className={cx(
                  "mt-1 text-sm leading-6",
                  notePreview ? "text-[var(--theme-text-default)]" : "text-[var(--theme-text-muted)]"
                )}
              >
                {isNoteOpen
                  ? "Короткий комментарий к этому номеру."
                  : notePreview ?? "Добавить короткую заметку к этому номеру"}
              </p>
            </div>
            <span className="flex flex-none items-center gap-2 self-center">
              <span className="hidden text-xs font-semibold text-[var(--theme-text-muted)] sm:block">
                {isNoteOpen ? "Свернуть" : notePreview ? "Изменить" : "Добавить"}
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] text-[var(--theme-text-muted)] transition group-hover:border-[var(--theme-accent-border)] group-hover:text-[var(--theme-accent-text)]">
                {isNoteOpen ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 15.75l-7.5-7.5-7.5 7.5" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 113.182 3.182L8.25 19.463 3.75 20.25l.787-4.5L16.862 4.487z" />
                  </svg>
                )}
              </span>
            </span>
          </button>

          {isNoteOpen ? (
            <>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="ui-copy-soft text-xs">{number.note.length}/240</span>
              </div>
              <textarea
                rows={2}
                maxLength={240}
                value={number.note}
                onChange={(event) => onNoteChange(number.id, event.target.value)}
                onBlur={() => onNoteBlur(number.id)}
                placeholder="Короткая заметка к этому номеру"
                className="ui-input mt-2.5 min-h-[64px] w-full resize-none rounded-[12px] px-3 py-2.5 text-sm sm:rounded-2xl sm:py-3"
              />
              <p className="ui-hint ui-copy-soft mt-1.5 text-xs leading-5">Сохранится автоматически.</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}, (previousProps, nextProps) =>
  previousProps.notesEnabled === nextProps.notesEnabled &&
  previousProps.number === nextProps.number &&
  previousProps.homeworkGroup === nextProps.homeworkGroup
);

const StudentNumberRow = memo(function StudentNumberRow({
  number,
  top,
  notesEnabled,
  homeworkGroup,
  onSelect,
  onNoteChange,
  onNoteBlur,
  onHeightChange
}: StudentNumberCardProps & {
  top: number;
  homeworkGroup: HomeworkGroup | null;
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
        homeworkGroup={homeworkGroup}
        onSelect={onSelect}
        onNoteChange={onNoteChange}
        onNoteBlur={onNoteBlur}
      />
    </div>
  );
}, (previousProps, nextProps) =>
  previousProps.top === nextProps.top &&
  previousProps.notesEnabled === nextProps.notesEnabled &&
  previousProps.number === nextProps.number &&
  previousProps.homeworkGroup === nextProps.homeworkGroup
);

function StudentNumberList({
  numbers,
  resetKey,
  notesEnabled,
  homeworkGroupsByDeadline,
  onSelect,
  onNoteChange,
  onNoteBlur
}: StudentNumberListProps) {
  const shouldVirtualize = numbers.length > VIRTUALIZATION_THRESHOLD;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
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
      scrollFrameRef.current = null;

      const nextScrollTop = element.scrollTop;
      const nextViewportHeight = element.clientHeight;

      setScrollTop((current) => (current === nextScrollTop ? current : nextScrollTop));
      setViewportHeight((current) => (current === nextViewportHeight ? current : nextViewportHeight));
    };

    const requestMetricsSync = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }

      scrollFrameRef.current = window.requestAnimationFrame(syncMetrics);
    };

    syncMetrics();
    element.addEventListener("scroll", requestMetricsSync, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      requestMetricsSync();
    });

    resizeObserver.observe(element);

    return () => {
      element.removeEventListener("scroll", requestMetricsSync);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [shouldVirtualize]);

  useEffect(() => {
    const element = scrollRef.current;

    if (!element) {
      return;
    }

    element.scrollTop = 0;
    setScrollTop(0);
  }, [resetKey]);

  const metrics = useMemo(() => {
    let offset = 0;
    const starts: number[] = [];

    const items = numbers.map((number) => {
      const size = measuredHeights[number.id] ?? estimateStudentNumberCardHeight(number, notesEnabled);
      starts.push(offset);
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
      starts,
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
    const startIndex = findStartIndex(metrics.starts, startOffset);
    let endIndex = startIndex;

    while (endIndex < metrics.items.length && metrics.items[endIndex]!.start < endOffset) {
      endIndex += 1;
    }

    return metrics.items.slice(startIndex, Math.min(metrics.items.length, endIndex + 1));
  }, [metrics.items, metrics.starts, scrollTop, shouldVirtualize, viewportHeight]);

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

  return (
    <div className="student-virtual-shell rounded-[14px] border border-[var(--theme-border-soft)] p-2 sm:rounded-[24px] sm:p-3">
      <div
        ref={scrollRef}
        className="student-virtual-scroll rounded-[12px] sm:rounded-[18px]"
        style={{
          maxHeight: "72vh"
        }}
      >
        {shouldVirtualize ? (
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
                  homeworkGroup={number.deadlineAt ? (homeworkGroupsByDeadline.get(number.deadlineAt) ?? null) : null}
                  onSelect={onSelect}
                  onNoteChange={onNoteChange}
                  onNoteBlur={onNoteBlur}
                  onHeightChange={handleHeightChange}
                />
              );
            })}
          </div>
        ) : (
          <div className="student-number-list space-y-4">
            {numbers.map((number) => (
              <StudentNumberCard
                key={number.id}
                number={number}
                notesEnabled={notesEnabled}
                homeworkGroup={number.deadlineAt ? (homeworkGroupsByDeadline.get(number.deadlineAt) ?? null) : null}
                onSelect={onSelect}
                onNoteChange={onNoteChange}
                onNoteBlur={onNoteBlur}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StudentTopicStatusBoard({
  topicId,
  totalNumbers,
  notesEnabled,
  initialHomeworkFilterId,
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
  const [activeFilter, setActiveFilter] = useState<HomeworkFilterId>(initialHomeworkFilterId ?? "all");
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
      progressPercent: completionPercent(markedCount, totalNumbers),
      solvedProgressPercent: completionPercent(solvedCount, totalNumbers)
    };
  }, [numbers, totalNumbers]);

  const homeworkGroups = useMemo<HomeworkGroup[]>(() => {
    const grouped = new Map<string, StudentNumberState[]>();

    for (const number of numbers) {
      if (!number.deadlineAt) {
        continue;
      }

      const current = grouped.get(number.deadlineAt) ?? [];
      current.push(number);
      grouped.set(number.deadlineAt, current);
    }

    return Array.from(grouped.entries())
      .sort((left, right) => new Date(left[0]).getTime() - new Date(right[0]).getTime())
      .map(([deadlineAt, groupedNumbers], index) => {
        const solvedCount = groupedNumbers.filter(
          (number) => number.status === HomeworkNumberStatus.GREEN || number.status === HomeworkNumberStatus.YELLOW
        ).length;

        return {
          id: deadlineAt,
          label: `ДЗ ${index + 1}`,
          deadlineAt,
          deadlineLabel: formatDeadlineLabel(deadlineAt),
          count: groupedNumbers.length,
          solvedCount,
          isCompleted: groupedNumbers.length > 0 && solvedCount === groupedNumbers.length
        };
      });
  }, [numbers]);
  const homeworkGroupsByDeadline = useMemo(
    () => new Map(homeworkGroups.map((group) => [group.id, group])),
    [homeworkGroups]
  );
  const filteredNumbers = useMemo(() => {
    if (!homeworkGroups.length || activeFilter === "all") {
      return numbers;
    }

    return numbers.filter((number) => number.deadlineAt === activeFilter);
  }, [activeFilter, homeworkGroups.length, numbers]);
  const deferredFilteredNumbers = useDeferredValue(filteredNumbers);
  const isTopicCompleted = totalNumbers > 0 && summary.solvedCount === totalNumbers;
  const hasHomeworkFilters = homeworkGroups.length > 0;
  const hasIssuedHomeworkGroups = homeworkGroups.length > 0;

  useEffect(() => {
    if (!hasIssuedHomeworkGroups) {
      if (activeFilter !== "all") {
        setActiveFilter("all");
      }

      return;
    }

    if (!homeworkGroupsByDeadline.has(activeFilter)) {
      setActiveFilter(homeworkGroups[0]!.id);
    }
  }, [activeFilter, hasIssuedHomeworkGroups, homeworkGroups, homeworkGroupsByDeadline]);

  useEffect(() => {
    if (!initialHomeworkFilterId) {
      return;
    }

    setActiveFilter(initialHomeworkFilterId);
  }, [initialHomeworkFilterId]);

  useEffect(() => {
    if (!hasIssuedHomeworkGroups) {
      return;
    }

    if (activeFilter === "all") {
      setActiveFilter(homeworkGroups[0]!.id);
    }
  }, [activeFilter, hasIssuedHomeworkGroups, homeworkGroups]);

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
      markStudentTopicsNeedsRefresh();
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
      <SectionCard
        title="Номера"
        description={
          notesEnabled
            ? "Отмечайте номера и при необходимости добавляйте заметки."
            : "Отмечайте номера цветом. Повторный клик снимает статус."
        }
      >
        {saveError ? (
          <div className="ui-notice-error mb-4 rounded-[12px] px-3.5 py-3 text-sm font-medium sm:mb-5 sm:rounded-[18px] sm:px-4 sm:py-4">
            {saveError}
          </div>
        ) : null}

        {hasHomeworkFilters ? (
          <div className="mb-4 space-y-2.5 sm:mb-5 sm:space-y-3">
            <p className="text-sm font-medium text-[var(--theme-text-muted)]">Выберите ДЗ</p>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
              {homeworkGroups.map((group) => {
                const isActive = activeFilter === group.id;
                const isCompleted = group.isCompleted;
                const baseFilterClassName =
                  "ui-pressable w-full rounded-[12px] border px-3 py-2 text-left text-sm font-medium transition sm:inline-flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-2 sm:rounded-[16px] sm:px-5 sm:py-2.5";
                const activeFilterClassName =
                  "border-[var(--theme-border-soft)] bg-[var(--theme-tab-active)] text-[var(--theme-tab-text-active)] shadow-[0_4px_10px_rgba(15,23,42,0.06)]";
                const inactiveFilterClassName =
                  "border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] text-[var(--theme-text-default)] hover:border-[var(--theme-accent)]/45 hover:text-[var(--theme-text-strong)]";

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setActiveFilter(group.id);
                      });
                    }}
                    data-active={isActive}
                    className={cx(
                      baseFilterClassName,
                      isActive ? activeFilterClassName : inactiveFilterClassName
                    )}
                  >
                    <span className="flex items-center justify-between gap-3 sm:contents">
                      <span className="flex items-center gap-2">
                        {isCompleted ? <span className="text-[var(--theme-accent-text)]">✓</span> : null}
                        <span>{group.label}</span>
                      </span>
                      <span className="ui-chip-count rounded-[8px] px-1.5 py-0.5 text-xs font-semibold">
                        {group.solvedCount}/{group.count}
                      </span>
                    </span>
                    {group.deadlineLabel ? (
                      <span className="mt-1 block text-xs text-[var(--theme-text-muted)] sm:hidden">{group.deadlineLabel}</span>
                    ) : null}
                    {group.deadlineLabel ? (
                      <span className="hidden text-xs text-[var(--theme-text-muted)] sm:inline">{group.deadlineLabel}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">
              Показаны номера выбранного ДЗ: {deferredFilteredNumbers.length}.
            </p>
          </div>
        ) : null}

        {isTopicCompleted ? (
          <details className="rounded-[12px] border border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] sm:rounded-[20px]">
            <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-[var(--theme-success-text)]">Тема полностью решена</p>
                <p className="ui-hint mt-1 text-sm leading-6 text-[var(--theme-success-text)]">Подробности можно открыть в любой момент.</p>
              </div>
              <span className="rounded-[9px] border border-[var(--theme-success-border)] bg-[var(--theme-surface-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--theme-success-text)] sm:rounded-[12px] sm:px-4 sm:py-2">
                Показать номера
              </span>
            </summary>

            <div className="border-t border-[var(--theme-success-border)] px-3 py-3 sm:px-4 sm:py-4">
              {deferredFilteredNumbers.length > 0 ? (
                <StudentNumberList
                  numbers={deferredFilteredNumbers}
                  resetKey={activeFilter}
                  notesEnabled={notesEnabled}
                  homeworkGroupsByDeadline={homeworkGroupsByDeadline}
                  onSelect={updateNumberStatus}
                  onNoteChange={updateNumberNote}
                  onNoteBlur={flushNumberNote}
                />
              ) : (
                <div className="ui-panel-soft rounded-[12px] border border-dashed px-3.5 py-6 text-center text-sm text-[var(--theme-text-muted)] sm:rounded-[22px] sm:px-4 sm:py-8">
                  По выбранному фильтру здесь пока ничего нет.
                </div>
              )}
            </div>
          </details>
        ) : (
          <>
            {deferredFilteredNumbers.length > 0 ? (
              <StudentNumberList
                numbers={deferredFilteredNumbers}
                resetKey={activeFilter}
                notesEnabled={notesEnabled}
                homeworkGroupsByDeadline={homeworkGroupsByDeadline}
                onSelect={updateNumberStatus}
                onNoteChange={updateNumberNote}
                onNoteBlur={flushNumberNote}
              />
            ) : (
              <div className="ui-panel-soft rounded-[14px] border border-dashed px-4 py-8 text-center sm:rounded-[24px] sm:py-10">
                <p className="font-display text-[1.45rem] font-semibold text-[var(--theme-text-strong)] sm:text-2xl">Ничего не найдено</p>
                <p className="ui-hint mt-1.5 text-sm leading-6 text-[var(--theme-text-muted)] sm:mt-2">Попробуйте другой фильтр.</p>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Прогресс по теме" description="Здесь учитываются только зелёные и жёлтые номера.">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
            <span>Прорешано номеров</span>
            <span className="font-semibold text-[var(--theme-text-strong)]">
              {summary.solvedCount} / {totalNumbers}
            </span>
          </div>
          <ProgressBar value={summary.solvedProgressPercent} size="md" />
        </div>
        {hasIssuedHomeworkGroups ? (
          <p className="ui-hint mt-3.5 text-sm leading-6 text-[var(--theme-text-muted)] sm:mt-4">Дедлайны указаны в фильтрах ДЗ.</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
