"use client";

const resultOptions = [
  { value: "SOLVED", label: "✓", title: "Решил на уроке", background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" },
  { value: "PARTIAL", label: "±", title: "Решил с ошибками", background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" },
  {
    value: "NOT_SOLVED",
    label: "✕",
    title: "Не решил — номер вернётся в подбор",
    background: "var(--shbz-danger-bg)",
    color: "var(--shbz-danger-text)"
  }
] as const;

/** Светофор итога урока на карточке номера: повторный клик снимает отметку. */
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
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`} role="group" aria-label="Итог урока">
      {resultOptions.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(active ? null : option.value)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] border text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
            style={
              active
                ? { background: option.background, color: option.color, borderColor: "currentColor" }
                : {
                    background: "transparent",
                    color: "var(--shbz-text-muted)",
                    borderColor: "var(--shbz-soft-border)",
                    opacity: 0.7
                  }
            }
          >
            {option.label}
          </button>
        );
      })}
    </span>
  );
}
