import { cache } from "react";
import type { TimelineEntry } from "@/lib/progress-timeline";
import { getProgressTimeline } from "@/lib/platform-data";

export type StudentStreak = {
  currentStreak: number;
  bestStreak: number;
  solvedToday: number;
  solvedThisWeek: number;
  activeDaysThisWeek: number;
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
  const activeDaysThisWeek = last7.filter((entry) => entry.closedCount > 0).length;

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
    activeDaysThisWeek,
    dailyActivity
  };
}

// Uncached version: safe to call from Route Handlers (outside the RSC render scope,
// React's cache() can leak results across requests in the same Node process,
// which would freeze the streak after the first fetch).
export async function computeStudentStreak(studentId: string): Promise<StudentStreak> {
  const entries = await getProgressTimeline(studentId, 112);
  return buildStudentStreak(entries);
}

// Cached version: dedupes calls within a single Server Component render
// (e.g. layout + page in the same request both reading the streak).
export const getStudentStreakSnapshot = cache(computeStudentStreak);
