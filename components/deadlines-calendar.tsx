"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeadlineList } from "@/components/deadline-list";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";

type DeadlinesCalendarProps = {
  deadlines: StudentDeadlineAssignment[];
};

const weekDayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDayKey(value: string) {
  const [rawYear, rawMonth, rawDay] = value.split("-");
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  return new Date(year, month - 1, day);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function getMonthDays(monthStart: Date) {
  const days: Date[] = [];
  const firstDayOffset = (monthStart.getDay() + 6) % 7;
  const firstCellDate = new Date(monthStart);
  firstCellDate.setDate(monthStart.getDate() - firstDayOffset);

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(firstCellDate);
    day.setDate(firstCellDate.getDate() + i);
    days.push(day);
  }

  return days;
}

export function DeadlinesCalendar({ deadlines }: DeadlinesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [previewDayKey, setPreviewDayKey] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const deadlinesByDay = useMemo(() => {
    const grouped = new Map<string, StudentDeadlineAssignment[]>();
    for (const deadline of deadlines) {
      const key = toDayKey(new Date(deadline.deadlineAt));
      const list = grouped.get(key) ?? [];
      list.push(deadline);
      grouped.set(key, list);
    }
    return grouped;
  }, [deadlines]);

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const todayKey = toDayKey(new Date());

  useEffect(() => {
    setPreviewDayKey(null);
  }, [currentMonth]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (!target || !calendarRef.current) {
        return;
      }

      if (!calendarRef.current.contains(target)) {
        setPreviewDayKey(null);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewDayKey(null);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={calendarRef} className="ui-surface min-h-[430px] rounded-[16px] border p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="ui-pressable ui-button-secondary rounded-[10px] px-3 py-1.5 text-sm font-semibold"
        >
          Назад
        </button>
        <p className="font-display text-base font-semibold capitalize text-[var(--theme-text-strong)] sm:text-lg">{monthLabel(currentMonth)}</p>
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="ui-pressable ui-button-secondary rounded-[10px] px-3 py-1.5 text-sm font-semibold"
        >
          Вперёд
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDayLabels.map((label) => (
          <div key={label} className="px-1 py-1 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-muted)]">
            {label}
          </div>
        ))}

        {monthDays.map((day) => {
          const dayKey = toDayKey(day);
          const dayItems = deadlinesByDay.get(dayKey) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const isToday = dayKey === todayKey;
          const hasDeadlines = isCurrentMonth && dayItems.length > 0;
          const dayTime = fromDayKey(dayKey).getTime();
          const hasOverdue = dayItems.some((item) => {
            const isSolved = item.status === "DONE";
            return !isSolved && dayTime < Date.now();
          });
          const hasSoon = !hasOverdue && dayItems.length > 0 && dayTime - Date.now() <= 1000 * 60 * 60 * 24 * 2;
          const isPreviewOpen = isCurrentMonth && previewDayKey === dayKey;

          return (
            <div
              key={dayKey}
              className="relative"
            >
              <button
                type="button"
                disabled={!isCurrentMonth}
                onClick={() => {
                  if (!isCurrentMonth) {
                    return;
                  }

                  setPreviewDayKey((current) => (current === dayKey ? null : dayKey));
                }}
                aria-expanded={isPreviewOpen}
                className={`relative flex h-12 w-full flex-col items-center justify-center rounded-[10px] border text-sm transition ${
                  isCurrentMonth
                    ? "border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] text-[var(--theme-text-strong)] hover:border-[var(--theme-accent-border)]"
                    : "border-transparent bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)] opacity-70"
                } ${isToday ? "ring-1 ring-[var(--theme-accent-border)]" : ""} ${
                  hasOverdue ? "border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger-text)]" : hasSoon ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)]" : ""
                } ${isCurrentMonth ? "cursor-pointer" : "cursor-default"}`}
              >
                <span>{day.getDate()}</span>
                {hasDeadlines ? (
                  <span
                    aria-hidden
                    className={`mt-1 inline-flex h-2.5 w-2.5 rotate-45 rounded-[2px] ${
                      hasOverdue
                        ? "bg-[var(--theme-danger-solid)]"
                        : hasSoon
                        ? "bg-[rgb(245,158,11)]"
                        : "bg-[var(--theme-accent)]"
                    }`}
                  />
                ) : null}
              </button>

              {isCurrentMonth ? (
                <div
                  className={`absolute left-1/2 top-[calc(100%+8px)] z-20 w-64 -translate-x-1/2 rounded-[12px] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-2 shadow-lg transition-all duration-200 ease-out ${
                    isPreviewOpen
                      ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none -translate-y-1 scale-[0.98] opacity-0"
                  }`}
                >
                  <div className="mb-2 rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] px-2.5 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--theme-text-muted)]">Дедлайн по ДЗ</p>
                    <p className="mt-0.5 text-sm font-semibold text-[var(--theme-text-strong)]">
                      {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(day)}
                    </p>
                  </div>
                  <DeadlineList items={dayItems} compact emptyMessage="На этот день дедлайн не назначен." />
                  {dayItems.length > 0 ? (
                    <p className="ui-hint mt-2 text-[11px] text-[var(--theme-text-muted)]">Нажмите вне окна или Esc, чтобы закрыть.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
