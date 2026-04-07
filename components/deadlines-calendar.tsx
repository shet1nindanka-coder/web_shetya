"use client";

import { useMemo, useState } from "react";
import { DeadlineList, type DeadlineListItem } from "@/components/deadline-list";

type DeadlinesCalendarProps = {
  deadlines: DeadlineListItem[];
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
  const [activeDayKey, setActiveDayKey] = useState<string | null>(null);

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
  const selectedDayItems = activeDayKey ? (deadlinesByDay.get(activeDayKey) ?? []) : [];
  const todayKey = toDayKey(new Date());
  const activeLabel = activeDayKey
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(fromDayKey(activeDayKey))
    : "Выберите день";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="ui-surface rounded-[16px] border p-3 sm:p-4">
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
            const hasDeadlines = dayItems.length > 0;
            const dayTime = fromDayKey(dayKey).getTime();
            const hasOverdue = dayItems.some((item) => {
              const isSolved = item.status === "GREEN" || item.status === "YELLOW";
              return !isSolved && dayTime < Date.now();
            });
            const hasSoon = !hasOverdue && dayItems.length > 0 && dayTime - Date.now() <= 1000 * 60 * 60 * 24 * 2;

            return (
              <div key={dayKey} className="group relative">
                <button
                  type="button"
                  onMouseEnter={() => setActiveDayKey(dayKey)}
                  onFocus={() => setActiveDayKey(dayKey)}
                  onClick={() => setActiveDayKey(dayKey)}
                  className={`relative flex h-12 w-full flex-col items-center justify-center rounded-[10px] border text-sm transition ${
                    isCurrentMonth
                      ? "border-slate-200 bg-white text-[var(--theme-text-strong)] hover:border-brand-300"
                      : "border-transparent bg-slate-50/60 text-[var(--theme-text-muted)]"
                  } ${isToday ? "ring-1 ring-brand-300" : ""} ${
                    hasOverdue ? "border-rose-200 bg-rose-50/70 text-rose-700" : hasSoon ? "border-amber-200 bg-amber-50/70" : ""
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {hasDeadlines ? (
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full ${hasOverdue ? "bg-rose-500" : hasSoon ? "bg-amber-500" : "bg-brand-500"}`} />
                  ) : null}
                </button>

                <div className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-20 hidden w-64 -translate-x-1/2 rounded-[12px] border bg-white p-2 shadow-lg group-hover:block group-focus-within:block">
                  <p className="mb-1 text-xs font-semibold text-[var(--theme-text-muted)]">
                    {new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(day)}
                  </p>
                  <DeadlineList items={dayItems} compact emptyMessage="На этот день дедлайнов нет." />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="ui-surface rounded-[16px] border p-3 sm:p-4">
        <p className="ui-kicker">День</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-[var(--theme-text-strong)]">{activeLabel}</h2>
        <div className="mt-3">
          <DeadlineList items={selectedDayItems} emptyMessage="Выберите день в календаре, чтобы увидеть дедлайны." />
        </div>
      </aside>
    </div>
  );
}
