"use client";

import { cx, homeworkStatusMeta } from "@/lib/utils";

// Итог урока → цвет светофора; подписи и стили кнопок — те же, что у статусов в проверке ДЗ.
const options = [
  { value: "SOLVED", status: "GREEN" },
  { value: "PARTIAL", status: "YELLOW" },
  { value: "NOT_SOLVED", status: "RED" }
] as const;

/** Кнопки итога урока «Зеленый/Желтый/Красный»: повторный клик по активной снимает отметку. */
export function ResultToggle({
  value,
  disabled,
  onChange,
  className
}: {
  value: string | null;
  disabled: boolean;
  onChange: (next: string | null) => void;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)} role="group" aria-label="Итог урока">
      {options.map((option) => {
        const active = value === option.value;
        const meta = homeworkStatusMeta[option.status];

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? null : option.value)}
            className={cx(
              "ui-pressable rounded-[12px] px-3 py-1.5 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
              active ? meta.buttonClassName : "ui-status-button"
            )}
          >
            {meta.shortLabel}
          </button>
        );
      })}
    </span>
  );
}
