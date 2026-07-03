"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ShbzDateTimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const WEEK_DAYS = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseValue(value: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDisplay(date: Date) {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function ShbzDateTimePicker({
  value,
  onChange,
  onCommit,
  disabled = false,
  placeholder = "Выбрать дату и время",
  className
}: ShbzDateTimePickerProps) {
  const selected = useMemo(() => parseValue(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setViewDate(parseValue(value) ?? new Date());
    }

    if (!isOpen && wasOpenRef.current) {
      onCommit?.();
    }

    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const monthCells = useMemo(() => {
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const lead = (monthStart.getDay() + 6) % 7;
    const start = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1 - lead);
    const cells: Date[] = [];

    for (let index = 0; index < 42; index += 1) {
      cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
    }

    return cells;
  }, [viewDate]);

  const pickDay = (day: Date) => {
    const next = new Date(day);

    if (selected) {
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      next.setHours(23, 59, 0, 0);
    }

    onChange(toInputValue(next));
  };

  const pickTime = (hours: number, minutes: number) => {
    const base = selected ?? new Date();
    const next = new Date(base);
    next.setHours(hours, minutes, 0, 0);
    onChange(toInputValue(next));
  };

  const today = new Date();

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        className="flex h-[46px] w-full items-center justify-between gap-2.5 rounded-[12px] border-[1.5px] px-3.5 text-left text-sm transition-[border-color,box-shadow]"
        style={{
          background: "var(--shbz-input-bg)",
          borderColor: isOpen ? "var(--shbz-input-border-focus)" : "var(--shbz-input-border)",
          boxShadow: isOpen ? "0 0 0 4px var(--shbz-input-ring)" : "none",
          color: selected ? "var(--shbz-text-strong)" : "var(--shbz-placeholder)",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer"
        }}
      >
        <span className="truncate font-medium">{selected ? formatDisplay(selected) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--shbz-kicker)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="3" x2="8" y2="7" />
          <line x1="16" y1="3" x2="16" y2="7" />
        </svg>
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[308px] max-w-[86vw] rounded-[18px] border p-4"
          style={{
            background: "var(--shbz-card-bg)",
            borderColor: "var(--shbz-card-border)",
            boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.18)"
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
              className="shbz-btn-outline px-3 py-1.5 text-[13px]"
              aria-label="Предыдущий месяц"
            >
              ←
            </button>
            <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
              className="shbz-btn-outline px-3 py-1.5 text-[13px]"
              aria-label="Следующий месяц"
            >
              →
            </button>
          </div>

          <div className="mb-1.5 grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((label) => (
              <div key={label} className="text-center text-[10px] font-bold tracking-[0.8px]" style={{ color: "var(--shbz-kicker)" }}>
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((day) => {
              const inMonth = day.getMonth() === viewDate.getMonth();
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isToday = isSameDay(day, today);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => pickDay(day)}
                  className="flex h-9 items-center justify-center rounded-[10px] text-[13px] font-semibold transition-colors"
                  style={{
                    background: isSelected ? "var(--shbz-accent-grad)" : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : inMonth
                        ? "var(--shbz-text-strong)"
                        : "var(--shbz-cal-out-text)",
                    boxShadow: !isSelected && isToday ? "inset 0 0 0 1.5px var(--shbz-accent-solid)" : "none"
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
              Время
            </span>
            <select
              value={selected ? selected.getHours() : ""}
              onChange={(event) => pickTime(Number(event.target.value), selected ? selected.getMinutes() : 59)}
              className="shbz-select shbz-select--sm"
              style={{ height: 38, width: 72, padding: "0 28px 0 12px", backgroundPosition: "right 10px center" }}
              aria-label="Часы"
            >
              <option value="" disabled>
                --
              </option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {pad(hour)}
                </option>
              ))}
            </select>
            <span className="font-bold" style={{ color: "var(--shbz-text-soft)" }}>:</span>
            <select
              value={selected ? selected.getMinutes() : ""}
              onChange={(event) => pickTime(selected ? selected.getHours() : 23, Number(event.target.value))}
              className="shbz-select shbz-select--sm"
              style={{ height: 38, width: 72, padding: "0 28px 0 12px", backgroundPosition: "right 10px center" }}
              aria-label="Минуты"
            >
              <option value="" disabled>
                --
              </option>
              {Array.from({ length: 60 }, (_, minute) => (
                <option key={minute} value={minute}>
                  {pad(minute)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--shbz-soft-border)" }}>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-[13px] font-semibold"
              style={{ color: "var(--shbz-danger-solid)" }}
            >
              Очистить
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const next = new Date();
                  next.setHours(23, 59, 0, 0);
                  onChange(toInputValue(next));
                  setViewDate(next);
                }}
                className="text-[13px] font-semibold"
                style={{ color: "var(--shbz-accent-solid)" }}
              >
                Сегодня
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="shbz-btn-dark px-4 py-1.5 text-[13px]" style={{ padding: "8px 16px" }}>
                Готово
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
