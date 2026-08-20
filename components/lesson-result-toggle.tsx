"use client";

import { cx, homeworkStatusMeta } from "@/lib/utils";

// Итог урока — отдельный словарь: «решил при мне» семантически не равен
// «зелёному» статусу домашнего ДЗ. Общий homeworkStatusMeta не меняется
// (решение владельца), отсюда переиспользуются только классы кнопок.
export const lessonResultMeta = {
  SOLVED: { label: "решил", glyph: "✓", buttonClassName: homeworkStatusMeta.GREEN.buttonClassName },
  PARTIAL: { label: "с ошибками", glyph: "↻", buttonClassName: homeworkStatusMeta.YELLOW.buttonClassName },
  NOT_SOLVED: { label: "не решил", glyph: "!", buttonClassName: homeworkStatusMeta.RED.buttonClassName }
} as const;

export type LessonResultValue = keyof typeof lessonResultMeta;

const options = Object.keys(lessonResultMeta) as LessonResultValue[];

/** Кнопки итога урока «решил / с ошибками / не решил»: повторный клик по активной снимает отметку. */
export function ResultToggle({
  value,
  disabled,
  onChange,
  className,
  size = "md"
}: {
  value: string | null;
  disabled: boolean;
  onChange: (next: string | null) => void;
  className?: string;
  /** lg — доска урока: сенсорные цели ≥44 px. */
  size?: "md" | "lg";
}) {
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)} role="group" aria-label="Итог урока">
      {options.map((option) => {
        const active = value === option;
        const meta = lessonResultMeta[option];

        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active ? null : option)}
            className={cx(
              "ui-pressable rounded-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
              size === "lg" ? "min-h-[44px] px-4 py-2 text-[13.5px]" : "px-3 py-1.5 text-[12.5px]",
              active ? meta.buttonClassName : "ui-status-button"
            )}
          >
            <span aria-hidden="true">{meta.glyph}</span> {meta.label}
          </button>
        );
      })}
    </span>
  );
}
