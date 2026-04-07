"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { memo, startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
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
  resetKey: HomeworkFilterId;
  notesEnabled: boolean;
  homeworkGroupsByDeadline: Map<string, HomeworkGroup>;
  onSelect: (homeworkNumberId: string, status: HomeworkNumberStatus | null) => void;
  onNoteChange: (homeworkNumberId: string, value: string) => void;
  onNoteBlur: (homeworkNumberId: string) => void;
};

type HomeworkFilterId = "all" | "without-homework" | string;

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
    <div className="student-number-card rounded-[22px] border p-3.5 sm:rounded-[24px] sm:p-4">
      <div className="student-number-header flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="student-number-title font-display text-[1.9rem] font-semibold text-[var(--theme-text-strong)]">№ {number.number}</h3>
            <HomeworkStatusBadge status={number.status} />
            {homeworkGroup ? (
              <Badge className="border-brand-200 bg-brand-50 text-brand-700">{homeworkGroup.label}</Badge>
            ) : null}
            {isSaving ? <span className="ui-copy-muted text-xs font-medium">Сохраняем...</span> : null}
          </div>
        </div>

        <div className="student-status-grid grid gap-2 sm:grid-cols-3">
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
                  "ui-pressable w-full touch-manipulation rounded-[18px] px-4 py-3 text-left text-[13px] transition-colors duration-75 sm:min-w-[160px]",
                  isActive
                    ? meta.cardClassName
                    : "ui-button-secondary"
                )}
              >
                <p className="font-semibold">{meta.shortLabel}</p>
                <p className="mt-1.5 leading-5">{meta.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {notesEnabled ? (
        <div className="student-note-panel mt-3 rounded-[18px] border px-3.5 py-3 sm:rounded-[20px] sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-copy-muted text-sm leading-5">
                {notePreview ? "Есть сохраненная заметка." : "Можно оставить короткую заметку."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNoteOpen((current) => !current)}
              className="ui-pressable ui-button-secondary w-full rounded-[14px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto"
            >
              {isNoteOpen ? "Скрыть заметку" : notePreview ? "Открыть заметку" : "Добавить заметку"}
            </button>
          </div>

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
                className="ui-input mt-2.5 min-h-[68px] w-full resize-none rounded-2xl px-3 py-3 text-sm"
              />
              <p className="ui-copy-soft mt-1.5 text-xs leading-5">Сохранится автоматически.</p>
            </>
          ) : notePreview ? (
            <div className="ui-card-soft mt-2.5 rounded-2xl px-3 py-2.5 text-sm leading-5 text-[var(--theme-text-default)]">
              {notePreview}
            </div>
          ) : null}
        </div>
      ) : null}

      {number.answerLatex ? (
        <div className="student-answer-panel mt-3 rounded-[18px] border p-3 sm:rounded-[20px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-copy-muted text-sm leading-5">Ответ откроется только по вашему клику.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsAnswerVisible((current) => !current)}
              className="ui-pressable ui-button-secondary w-full rounded-[14px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto"
            >
              {isAnswerVisible ? "Скрыть ответ" : "Открыть ответ"}
            </button>
          </div>

          {isAnswerVisible ? (
            <div className="ui-card-soft mt-2.5 overflow-hidden rounded-[18px]">
              <div className="px-4 py-3.5">
                <LatexAnswerPreview value={number.answerLatex} />
              </div>
            </div>
          ) : (
            <div className="ui-card-soft ui-copy-muted mt-2.5 rounded-[18px] border border-dashed px-4 py-3 text-sm leading-5">
              Ответ скрыт, пока вы его не откроете.
            </div>
          )}
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
    <div className="student-virtual-shell rounded-[28px] border border-slate-200 bg-slate-50/45 p-3">
      <div
        ref={scrollRef}
        className="student-virtual-scroll rounded-[22px]"
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
  const [activeFilter, setActiveFilter] = useState<HomeworkFilterId>("all");
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
    if (!hasIssuedHomeworkGroups) {
      return;
    }

    if (activeFilter === "all" || activeFilter === "without-homework") {
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
          <div className="mb-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
            {saveError}
          </div>
        ) : null}

        {hasHomeworkFilters ? (
          <div className="mb-5 space-y-3">
            <p className="text-sm font-medium text-slate-500">Выберите ДЗ</p>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
              {homeworkGroups.map((group) => {
                const isActive = activeFilter === group.id;
                const isCompleted = group.isCompleted;

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
                      "ui-pressable w-full rounded-[16px] border px-4 py-2.5 text-left text-sm font-medium transition sm:inline-flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-2 sm:px-5 sm:py-2.5",
                      isActive && isCompleted
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[0_12px_24px_rgba(16,185,129,0.14)]"
                        : isActive
                        ? "border-brand-200 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.92))] text-brand-700 shadow-[0_12px_24px_rgba(59,130,246,0.14)]"
                        : isCompleted
                        ? "border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                        : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
                    )}
                  >
                    <span className="flex items-center justify-between gap-3 sm:contents">
                      <span className="flex items-center gap-2">
                        {isCompleted ? <span>✓</span> : null}
                        <span>{group.label}</span>
                      </span>
                      <span className="ui-chip-count rounded-[10px] px-2 py-0.5 text-xs font-semibold">
                        {group.solvedCount}/{group.count}
                      </span>
                    </span>
                    {group.deadlineLabel ? (
                      <span className="mt-1.5 block text-xs text-slate-500 sm:hidden">{group.deadlineLabel}</span>
                    ) : null}
                    {group.deadlineLabel ? (
                      <span className="hidden text-xs text-slate-500 sm:inline">{group.deadlineLabel}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <p className="ui-hint text-sm leading-6 text-slate-500">
              Показаны номера выбранного ДЗ: {deferredFilteredNumbers.length}.
            </p>
          </div>
        ) : null}

        {isTopicCompleted ? (
          <details className="rounded-[20px] border border-emerald-200 bg-emerald-50/70">
            <summary className="ui-pressable flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Тема полностью решена</p>
                <p className="ui-hint mt-1 text-sm leading-6 text-emerald-800">Подробности можно открыть в любой момент.</p>
              </div>
              <span className="rounded-[12px] border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800">
                Показать номера
              </span>
            </summary>

            <div className="border-t border-emerald-100 px-4 py-4">
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
                <div className="rounded-[22px] border border-dashed border-emerald-200 bg-white/70 px-4 py-8 text-center text-sm text-emerald-900">
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
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
                <p className="font-display text-2xl font-semibold text-slate-950">Ничего не найдено</p>
                <p className="ui-hint mt-2 text-sm leading-6 text-slate-600">Попробуйте другой фильтр.</p>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title="Прогресс по теме" description="Здесь учитываются только зелёные и жёлтые номера.">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Прорешано номеров</span>
            <span className="font-semibold text-slate-950">
              {summary.solvedCount} / {totalNumbers}
            </span>
          </div>
          <ProgressBar value={summary.solvedProgressPercent} />
        </div>
        {hasIssuedHomeworkGroups ? (
          <p className="ui-hint mt-4 text-sm leading-6 text-slate-600">Дедлайны указаны в фильтрах ДЗ.</p>
        ) : null}
      </SectionCard>
    </div>
  );
}
