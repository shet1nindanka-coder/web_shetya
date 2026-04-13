import type { TimelineEntry } from "@/lib/progress-timeline";

export type StudentStreak = {
  currentStreak: number;
  bestStreak: number;
  solvedToday: number;
  solvedThisWeek: number;
  dailyActivity: Array<{
    date: string;
    dayLabel: string;
    count: number;
  }>;
};

const SHORT_DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function getDayOfWeekIndex(dateString: string) {
  const date = new Date(`${dateString}T12:00:00`);
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function buildStudentStreak(entries: TimelineEntry[]): StudentStreak {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  const todayEntry = sorted[0];
  const solvedToday = todayEntry ? todayEntry.closedCount : 0;

  // Current streak: consecutive days with closedCount > 0, starting from today/yesterday
  let currentStreak = 0;
  let streakStartIndex = 0;

  // If today has 0 solved, check if it's still early — start from yesterday
  if (sorted[0] && sorted[0].closedCount === 0) {
    streakStartIndex = 1;
  }

  for (let i = streakStartIndex; i < sorted.length; i++) {
    if (sorted[i]!.closedCount > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Best streak
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]!.closedCount > 0) {
      tempStreak++;
      bestStreak = Math.max(bestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // Last 7 days activity
  const last7 = sorted.slice(0, 7).reverse();
  const solvedThisWeek = last7.reduce((sum, e) => sum + e.closedCount, 0);

  const dailyActivity = last7.map((entry) => ({
    date: entry.date,
    dayLabel: SHORT_DAY_NAMES[getDayOfWeekIndex(entry.date)]!,
    count: entry.closedCount
  }));

  return {
    currentStreak,
    bestStreak,
    solvedToday,
    solvedThisWeek,
    dailyActivity
  };
}
