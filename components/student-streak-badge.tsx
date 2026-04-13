import { cx } from "@/lib/utils";

type StudentStreakBadgeProps = {
  currentStreak: number;
  size?: "sm" | "md";
  className?: string;
};

export function StudentStreakBadge({
  currentStreak,
  size = "sm",
  className
}: StudentStreakBadgeProps) {
  const active = currentStreak > 0;

  return (
    <span
      className={cx("app-streak-pill inline-flex items-center rounded-full border font-semibold", className)}
      data-active={active}
      data-size={size}
      aria-label={active ? `Стрик: ${currentStreak} ${formatFullDays(currentStreak)}` : "Стрик пока не начат"}
    >
      <span className="app-streak-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" className="h-[1em] w-[1em]">
          <path
            d="M12.4 2.75c.38 2.14 1.67 3.64 2.9 5.03 1.53 1.74 2.95 3.39 2.95 5.9 0 3.54-2.88 6.42-6.42 6.42s-6.41-2.88-6.41-6.42c0-2.34 1.24-4.05 2.56-5.87.99-1.36 2.02-2.76 2.39-4.65.05-.27.27-.47.54-.5.26-.03.52.12.63.36.49 1.09 1.12 1.94 1.86 2.73.6-1.03 1-2.13 1.02-3.75 0-.29.18-.54.45-.65.27-.1.58-.02.76.2.37.46.62.87.77 1.2Z"
            fill="currentColor"
            opacity="0.92"
          />
          <path
            d="M12 11.25c.16 1.05.79 1.82 1.38 2.54.73.89 1.37 1.67 1.37 2.88 0 1.61-1.3 2.91-2.91 2.91a2.9 2.9 0 0 1-2.92-2.91c0-1.18.64-2 1.28-2.8.45-.58.92-1.17 1.12-1.98.05-.19.2-.33.4-.36.19-.03.39.05.5.21.2.29.45.54.72.77.2-.4.33-.84.33-1.44 0-.2.12-.37.3-.45.18-.07.38-.02.5.12.18.22.31.4.43.51Z"
            fill="currentColor"
            opacity="0.98"
          />
        </svg>
      </span>
      <span>{active ? `${currentStreak} ${size === "sm" ? shortDays(currentStreak) : formatFullDays(currentStreak)}` : "0 дн."}</span>
    </span>
  );
}

function shortDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "д.";
  }

  return "дн.";
}

function formatFullDays(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }

  return "дней";
}
