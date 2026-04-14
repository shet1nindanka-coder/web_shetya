"use client";

import type { CSSProperties } from "react";
import { cx } from "@/lib/utils";
import { getStudentStreakColorMeta, type StudentStreakColorTier } from "@/lib/student-streak-colors";
import { useStreakMotion } from "@/components/use-streak-motion";

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
  const motionState = useStreakMotion(currentStreak);
  const streakColorMeta = getStudentStreakColorMeta(currentStreak);
  const palette = STREAK_TIER_PALETTES[streakColorMeta.tier];
  const style = active
    ? ({
        "--streak-border": palette.light.border,
        "--streak-bg-start": palette.light.bgStart,
        "--streak-bg-end": palette.light.bgEnd,
        "--streak-text": palette.light.text,
        "--streak-shadow": palette.light.shadow,
        "--streak-icon-glow": palette.light.iconGlow,
        "--streak-border-dark": palette.dark.border,
        "--streak-bg-start-dark": palette.dark.bgStart,
        "--streak-bg-end-dark": palette.dark.bgEnd,
        "--streak-text-dark": palette.dark.text,
        "--streak-shadow-dark": palette.dark.shadow,
        "--streak-icon-glow-dark": palette.dark.iconGlow
      } as CSSProperties)
    : undefined;
  const nextColorLabel = streakColorMeta.nextThreshold
    ? `До следующего цвета осталось ${streakColorMeta.daysToNextThreshold} ${formatFullDays(streakColorMeta.daysToNextThreshold ?? 0)}`
    : "Открыт максимальный цвет стрика";

  return (
    <span
      className={cx("app-streak-pill inline-flex items-center rounded-full border font-semibold", className)}
      data-active={active}
      data-size={size}
      data-tier={streakColorMeta.tier}
      data-animate={motionState ?? undefined}
      aria-label={active ? `Стрик: ${currentStreak} ${formatFullDays(currentStreak)}. ${nextColorLabel}` : "Стрик пока не начат"}
      title={active ? nextColorLabel : "Стрик пока не начат"}
      style={style}
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

const STREAK_TIER_PALETTES: Record<
  StudentStreakColorTier,
  {
    light: {
      border: string;
      bgStart: string;
      bgEnd: string;
      text: string;
      shadow: string;
      iconGlow: string;
    };
    dark: {
      border: string;
      bgStart: string;
      bgEnd: string;
      text: string;
      shadow: string;
      iconGlow: string;
    };
  }
> = {
  starter: {
    light: {
      border: "rgba(251, 146, 60, 0.22)",
      bgStart: "rgba(255, 237, 213, 0.96)",
      bgEnd: "rgba(255, 247, 237, 0.9)",
      text: "#c2410c",
      shadow: "rgba(251, 146, 60, 0.14)",
      iconGlow: "rgba(251, 146, 60, 0.24)"
    },
    dark: {
      border: "rgba(251, 146, 60, 0.2)",
      bgStart: "rgba(127, 29, 29, 0.32)",
      bgEnd: "rgba(120, 53, 15, 0.22)",
      text: "#fdba74",
      shadow: "rgba(0, 0, 0, 0.24)",
      iconGlow: "rgba(251, 146, 60, 0.32)"
    }
  },
  ember: {
    light: {
      border: "rgba(249, 115, 22, 0.24)",
      bgStart: "rgba(255, 221, 191, 0.96)",
      bgEnd: "rgba(255, 242, 230, 0.92)",
      text: "#c2410c",
      shadow: "rgba(249, 115, 22, 0.16)",
      iconGlow: "rgba(249, 115, 22, 0.26)"
    },
    dark: {
      border: "rgba(249, 115, 22, 0.24)",
      bgStart: "rgba(154, 52, 18, 0.34)",
      bgEnd: "rgba(120, 53, 15, 0.24)",
      text: "#fdba74",
      shadow: "rgba(249, 115, 22, 0.2)",
      iconGlow: "rgba(249, 115, 22, 0.34)"
    }
  },
  amber: {
    light: {
      border: "rgba(245, 158, 11, 0.24)",
      bgStart: "rgba(254, 240, 197, 0.96)",
      bgEnd: "rgba(255, 247, 220, 0.92)",
      text: "#b45309",
      shadow: "rgba(245, 158, 11, 0.18)",
      iconGlow: "rgba(245, 158, 11, 0.28)"
    },
    dark: {
      border: "rgba(245, 158, 11, 0.24)",
      bgStart: "rgba(146, 64, 14, 0.34)",
      bgEnd: "rgba(120, 53, 15, 0.24)",
      text: "#fcd34d",
      shadow: "rgba(245, 158, 11, 0.22)",
      iconGlow: "rgba(245, 158, 11, 0.34)"
    }
  },
  lime: {
    light: {
      border: "rgba(132, 204, 22, 0.22)",
      bgStart: "rgba(236, 252, 203, 0.96)",
      bgEnd: "rgba(247, 254, 231, 0.92)",
      text: "#4d7c0f",
      shadow: "rgba(132, 204, 22, 0.18)",
      iconGlow: "rgba(132, 204, 22, 0.28)"
    },
    dark: {
      border: "rgba(132, 204, 22, 0.24)",
      bgStart: "rgba(63, 98, 18, 0.34)",
      bgEnd: "rgba(54, 83, 20, 0.24)",
      text: "#bef264",
      shadow: "rgba(132, 204, 22, 0.2)",
      iconGlow: "rgba(132, 204, 22, 0.32)"
    }
  },
  emerald: {
    light: {
      border: "rgba(16, 185, 129, 0.22)",
      bgStart: "rgba(209, 250, 229, 0.96)",
      bgEnd: "rgba(236, 253, 245, 0.92)",
      text: "#047857",
      shadow: "rgba(16, 185, 129, 0.18)",
      iconGlow: "rgba(16, 185, 129, 0.28)"
    },
    dark: {
      border: "rgba(16, 185, 129, 0.22)",
      bgStart: "rgba(6, 95, 70, 0.34)",
      bgEnd: "rgba(4, 120, 87, 0.24)",
      text: "#6ee7b7",
      shadow: "rgba(16, 185, 129, 0.22)",
      iconGlow: "rgba(16, 185, 129, 0.34)"
    }
  },
  cyan: {
    light: {
      border: "rgba(6, 182, 212, 0.22)",
      bgStart: "rgba(207, 250, 254, 0.96)",
      bgEnd: "rgba(236, 254, 255, 0.92)",
      text: "#0e7490",
      shadow: "rgba(6, 182, 212, 0.18)",
      iconGlow: "rgba(6, 182, 212, 0.28)"
    },
    dark: {
      border: "rgba(6, 182, 212, 0.22)",
      bgStart: "rgba(14, 116, 144, 0.32)",
      bgEnd: "rgba(8, 145, 178, 0.22)",
      text: "#67e8f9",
      shadow: "rgba(6, 182, 212, 0.22)",
      iconGlow: "rgba(6, 182, 212, 0.34)"
    }
  },
  blue: {
    light: {
      border: "rgba(59, 130, 246, 0.22)",
      bgStart: "rgba(219, 234, 254, 0.96)",
      bgEnd: "rgba(239, 246, 255, 0.92)",
      text: "#1d4ed8",
      shadow: "rgba(59, 130, 246, 0.18)",
      iconGlow: "rgba(59, 130, 246, 0.28)"
    },
    dark: {
      border: "rgba(59, 130, 246, 0.22)",
      bgStart: "rgba(29, 78, 216, 0.3)",
      bgEnd: "rgba(30, 64, 175, 0.24)",
      text: "#93c5fd",
      shadow: "rgba(59, 130, 246, 0.22)",
      iconGlow: "rgba(59, 130, 246, 0.34)"
    }
  },
  violet: {
    light: {
      border: "rgba(139, 92, 246, 0.22)",
      bgStart: "rgba(237, 233, 254, 0.96)",
      bgEnd: "rgba(245, 243, 255, 0.92)",
      text: "#6d28d9",
      shadow: "rgba(139, 92, 246, 0.18)",
      iconGlow: "rgba(139, 92, 246, 0.28)"
    },
    dark: {
      border: "rgba(139, 92, 246, 0.22)",
      bgStart: "rgba(91, 33, 182, 0.32)",
      bgEnd: "rgba(109, 40, 217, 0.24)",
      text: "#c4b5fd",
      shadow: "rgba(139, 92, 246, 0.22)",
      iconGlow: "rgba(139, 92, 246, 0.34)"
    }
  },
  rose: {
    light: {
      border: "rgba(244, 63, 94, 0.22)",
      bgStart: "rgba(255, 228, 230, 0.96)",
      bgEnd: "rgba(255, 241, 242, 0.92)",
      text: "#be123c",
      shadow: "rgba(244, 63, 94, 0.18)",
      iconGlow: "rgba(244, 63, 94, 0.28)"
    },
    dark: {
      border: "rgba(244, 63, 94, 0.22)",
      bgStart: "rgba(159, 18, 57, 0.32)",
      bgEnd: "rgba(190, 24, 93, 0.24)",
      text: "#fda4af",
      shadow: "rgba(244, 63, 94, 0.22)",
      iconGlow: "rgba(244, 63, 94, 0.34)"
    }
  },
  gold: {
    light: {
      border: "rgba(234, 179, 8, 0.26)",
      bgStart: "rgba(254, 249, 195, 0.98)",
      bgEnd: "rgba(254, 252, 232, 0.94)",
      text: "#a16207",
      shadow: "rgba(234, 179, 8, 0.2)",
      iconGlow: "rgba(234, 179, 8, 0.3)"
    },
    dark: {
      border: "rgba(234, 179, 8, 0.26)",
      bgStart: "rgba(133, 77, 14, 0.34)",
      bgEnd: "rgba(161, 98, 7, 0.24)",
      text: "#fde68a",
      shadow: "rgba(234, 179, 8, 0.24)",
      iconGlow: "rgba(234, 179, 8, 0.36)"
    }
  }
};

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
