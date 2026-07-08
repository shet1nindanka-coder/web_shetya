"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeadlineList, type DeadlineListItem } from "@/components/deadline-list";

type DeadlinesCalendarProps = {
  deadlines: DeadlineListItem[];
};

const weekDayLabels = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
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

function DiamondMark({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-[9px] w-[9px] rotate-45 rounded-[3px]" style={{ background: color }} />;
}

export function DeadlinesCalendar({ deadlines }: DeadlinesCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [previewDayKey, setPreviewDayKey] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);

  const deadlinesByDay = useMemo(() => {
    const grouped = new Map<string, DeadlineListItem[]>();
    for (const deadline of deadlines) {
      const key = toDayKey(new Date(deadline.deadlineAt));
      const list = grouped.get(key) ?? [];
      list.push(deadline);
      grouped.set(key, list);
    }
    return grouped;
  }, [deadlines]);

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);

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
    <div ref={calendarRef} className="shbz-card shbz-section-pad">
      <div className="mb-[26px] flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          className="shbz-btn-outline px-5 py-2.5 text-sm"
        >
          ← Назад
        </button>
        <p className="text-xl font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
          {monthLabel(currentMonth)}
        </p>
        <button
          type="button"
          onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          className="shbz-btn-outline px-5 py-2.5 text-sm"
        >
          Вперёд →
        </button>
      </div>

      <div className="mb-3 grid grid-cols-7 gap-2.5">
        {weekDayLabels.map((label) => (
          <div key={label} className="text-center text-xs font-bold tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2.5">
        {monthDays.map((day) => {
          const dayKey = toDayKey(day);
          const dayItems = deadlinesByDay.get(dayKey) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
          const hasDeadlines = isCurrentMonth && dayItems.length > 0;
          const hasIncomplete = hasDeadlines && dayItems.some((item) => item.status !== "DONE");
          const isPreviewOpen = isCurrentMonth && previewDayKey === dayKey;

          const cellBg = hasDeadlines
            ? hasIncomplete
              ? "var(--shbz-cal-late-bg)"
              : "var(--shbz-cal-ok-bg)"
            : isCurrentMonth
              ? "var(--shbz-cal-cell-bg)"
              : "var(--shbz-cal-out-bg)";
          const cellBorder = hasDeadlines
            ? hasIncomplete
              ? "var(--shbz-cal-late-border)"
              : "var(--shbz-cal-ok-border)"
            : "var(--shbz-cal-cell-border)";
          const markColor = hasIncomplete ? "var(--shbz-cal-late-mark)" : "var(--shbz-cal-ok-mark)";

          return (
            <div key={dayKey} className="relative">
              <button
                type="button"
                disabled={!isCurrentMonth || !hasDeadlines}
                onClick={() => {
                  if (!isCurrentMonth || !hasDeadlines) {
                    return;
                  }

                  setPreviewDayKey((current) => (current === dayKey ? null : dayKey));
                }}
                aria-expanded={isPreviewOpen}
                className="flex h-16 w-full flex-col items-center justify-center gap-[5px] rounded-[12px] border transition-shadow duration-150"
                style={{
                  background: cellBg,
                  borderColor: cellBorder,
                  cursor: hasDeadlines ? "pointer" : "default",
                  boxShadow: isPreviewOpen ? "0 0 0 3px var(--shbz-cal-ring)" : "none"
                }}
              >
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: isCurrentMonth ? "var(--shbz-text-strong)" : "var(--shbz-cal-out-text)" }}
                >
                  {day.getDate()}
                </span>
                {hasDeadlines ? <DiamondMark color={markColor} /> : null}
              </button>

              {isPreviewOpen ? (
                <div
                  className="absolute left-1/2 top-[calc(100%+10px)] z-30 w-[300px] max-w-[86vw] -translate-x-1/2 rounded-[18px] border p-3.5"
                  style={{
                    background: "var(--shbz-card-bg)",
                    borderColor: "var(--shbz-card-border)",
                    boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.14)"
                  }}
                >
                  <div className="mb-3 rounded-[12px] px-4 py-3" style={{ background: "var(--shbz-soft-bg)" }}>
                    <p className="text-[10.5px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                      Дедлайн по ДЗ
                    </p>
                    <p className="mt-1 text-base font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                      {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(day)}
                    </p>
                  </div>
                  <DeadlineList items={dayItems} compact emptyMessage="На этот день дедлайн не назначен." />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-[22px]">
        <div className="inline-flex items-center gap-2">
          <DiamondMark color="var(--shbz-cal-ok-mark)" />
          <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            Дедлайн ДЗ
          </span>
        </div>
        <div className="inline-flex items-center gap-2">
          <DiamondMark color="var(--shbz-cal-late-mark)" />
          <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            Есть невыполненные номера
          </span>
        </div>
      </div>
    </div>
  );
}
