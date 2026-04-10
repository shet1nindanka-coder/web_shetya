import { HomeworkNumberStatus } from "@prisma/client";
import { completionPercent } from "@/lib/utils";

export type TimelineEntry = {
  date: string;
  closedCount: number;
  redCount: number;
};

export type TimelinePeriod = "7d" | "4w" | "8w";

export type TimelineChartPoint = {
  key: string;
  label: string;
  tooltip: string;
  closedCount: number;
  redCount: number;
  totalCount: number;
  isEmpty: boolean;
};

type TimelineTrend = {
  direction: "up" | "down" | "flat";
  label: string;
};

export type ProgressTimelineView = {
  period: TimelinePeriod;
  title: string;
  description: string;
  points: TimelineChartPoint[];
  closedTotal: number;
  redTotal: number;
  totalChanges: number;
  averagePerPoint: number;
  trend: TimelineTrend;
};

type TimelineStatusEntry = {
  studentId: string;
  status: HomeworkNumberStatus | null;
  updatedAt?: Date | string | null;
};

type TimelineTopic = {
  homeworkNumbers: Array<{
    statuses: TimelineStatusEntry[];
  }>;
};

export type ProgressTimelinePoint = {
  key: string;
  label: string;
  tooltip: string;
  solved: number;
  review: number;
};

export type TeacherProgressTimeline = {
  solvedLast7Days: number;
  solvedLast30Days: number;
  reviewLast30Days: number;
  activeStudentsLast30Days: number;
  activeDaysLast30Days: number;
  solvedLast7DaysPrevious: number;
  solvedLast30DaysPrevious: number;
  daily: ProgressTimelinePoint[];
  weekly: ProgressTimelinePoint[];
};

type TimelineEvent = {
  studentId: string;
  status: HomeworkNumberStatus;
  updatedAt: Date;
};

type TeacherProgressTimelineOptions = {
  studentId?: string | null;
};

const PERIOD_CONFIG: Record<
  TimelinePeriod,
  {
    days: number;
    buckets: number;
    title: string;
    description: string;
    comparisonLabel: string;
    mode: "daily" | "weekly";
  }
> = {
  "7d": {
    days: 7,
    buckets: 7,
    title: "За последнюю неделю",
    description: "Показывает, как менялся прогресс по дням за последние 7 дней.",
    comparisonLabel: "к прошлой неделе",
    mode: "daily"
  },
  "4w": {
    days: 28,
    buckets: 4,
    title: "За последние 4 недели",
    description: "Помогает увидеть темп прохождения по неделям за последний месяц.",
    comparisonLabel: "к прошлым 4 неделям",
    mode: "weekly"
  },
  "8w": {
    days: 56,
    buckets: 8,
    title: "По неделям за 8 недель",
    description: "Показывает общий темп и просадки по неделям за последние 8 недель.",
    comparisonLabel: "к предыдущим 8 неделям",
    mode: "weekly"
  }
};

export function buildTeacherProgressTimeline(
  topics: TimelineTopic[],
  now = new Date(),
  options: TeacherProgressTimelineOptions = {}
): TeacherProgressTimeline {
  const allEvents = topics.flatMap((topic) =>
    topic.homeworkNumbers.flatMap((number) =>
      number.statuses.flatMap((status) => {
        if (!status.status) {
          return [];
        }

        const updatedAt = parseTimelineDate(status.updatedAt);

        if (!updatedAt) {
          return [];
        }

        return [
          {
            studentId: status.studentId,
            status: status.status,
            updatedAt
          } satisfies TimelineEvent
        ];
      })
    )
  );
  const events = options.studentId
    ? allEvents.filter((event) => event.studentId === options.studentId)
    : allEvents;

  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const last7DaysStart = addDays(todayStart, -6);
  const previous7DaysStart = addDays(last7DaysStart, -7);
  const last30DaysStart = addDays(todayStart, -29);
  const previous30DaysStart = addDays(last30DaysStart, -30);

  const currentWeekStart = startOfWeek(now);
  const daily = buildDailyTimeline(events, todayStart, 7);
  const weekly = buildWeeklyTimeline(events, currentWeekStart, 8);
  const activeDayKeys = new Set(
    events
      .filter((event) => isWithinRange(event.updatedAt, last30DaysStart, tomorrowStart))
      .map((event) => startOfDay(event.updatedAt).toISOString())
  );

  const activeStudentsLast30Days = new Set(
    events
      .filter((event) => isWithinRange(event.updatedAt, last30DaysStart, tomorrowStart))
      .map((event) => event.studentId)
  ).size;

  return {
    solvedLast7Days: countSolved(events, last7DaysStart, tomorrowStart),
    solvedLast30Days: countSolved(events, last30DaysStart, tomorrowStart),
    reviewLast30Days: countReview(events, last30DaysStart, tomorrowStart),
    activeStudentsLast30Days,
    activeDaysLast30Days: activeDayKeys.size,
    solvedLast7DaysPrevious: countSolved(events, previous7DaysStart, last7DaysStart),
    solvedLast30DaysPrevious: countSolved(events, previous30DaysStart, last30DaysStart),
    daily,
    weekly
  };
}

export function buildProgressTimelineView(
  entries: TimelineEntry[],
  period: TimelinePeriod
): ProgressTimelineView {
  const config = PERIOD_CONFIG[period];
  const normalizedEntries = [...entries].sort((left, right) => left.date.localeCompare(right.date));
  const currentEntries = normalizedEntries.slice(-config.days);
  const previousEntries = normalizedEntries.slice(-(config.days * 2), -config.days);
  const points =
    config.mode === "daily"
      ? currentEntries.map(toDailyChartPoint)
      : groupEntriesByWeek(currentEntries, config.buckets);
  const previousPoints =
    config.mode === "daily"
      ? previousEntries.map(toDailyChartPoint)
      : groupEntriesByWeek(previousEntries, config.buckets);
  const closedTotal = points.reduce((sum, point) => sum + point.closedCount, 0);
  const redTotal = points.reduce((sum, point) => sum + point.redCount, 0);
  const totalChanges = closedTotal + redTotal;
  const averagePerPoint = points.length > 0 ? totalChanges / points.length : 0;
  const previousClosedTotal = previousPoints.reduce((sum, point) => sum + point.closedCount, 0);

  return {
    period,
    title: config.title,
    description: config.description,
    points,
    closedTotal,
    redTotal,
    totalChanges,
    averagePerPoint,
    trend: buildTimelineTrend(closedTotal, previousClosedTotal, config.comparisonLabel)
  };
}

export function formatProgressTrend(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? "без изменений к прошлому периоду" : "новая активность в этом периоде";
  }

  const delta = current - previous;

  if (delta === 0) {
    return "на уровне прошлого периода";
  }

  const percent = completionPercent(Math.abs(delta), previous);
  const prefix = delta > 0 ? "+" : "-";

  return `${prefix}${Math.abs(delta)} (${prefix}${percent}%) к прошлому периоду`;
}

function buildTimelineTrend(current: number, previous: number, comparisonLabel: string): TimelineTrend {
  if (previous === 0) {
    if (current === 0) {
      return {
        direction: "flat" as const,
        label: `без изменений ${comparisonLabel}`
      };
    }

    return {
      direction: "up" as const,
      label: `новая активность ${comparisonLabel}`
    };
  }

  const delta = current - previous;

  if (delta === 0) {
    return {
      direction: "flat" as const,
      label: `на уровне ${comparisonLabel}`
    };
  }

  const percent = completionPercent(Math.abs(delta), previous);
  const direction: TimelineTrend["direction"] = delta > 0 ? "up" : "down";
  const prefix = delta > 0 ? "+" : "-";

  return {
    direction,
    label: `${prefix}${Math.abs(delta)} закрыто (${prefix}${percent}%) ${comparisonLabel}`
  };
}

function buildDailyTimeline(events: TimelineEvent[], todayStart: Date, days: number): ProgressTimelinePoint[] {
  const start = addDays(todayStart, -(days - 1));

  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index);
    const bucketEnd = addDays(bucketStart, 1);
    const bucketEvents = events.filter((event) => isWithinRange(event.updatedAt, bucketStart, bucketEnd));

    return {
      key: bucketStart.toISOString(),
      label: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(bucketStart),
      tooltip: new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(bucketStart),
      solved: bucketEvents.filter(isSolvedEvent).length,
      review: bucketEvents.filter(isReviewEvent).length
    };
  });
}

function toDailyChartPoint(entry: TimelineEntry): TimelineChartPoint {
  const date = new Date(`${entry.date}T00:00:00`);
  const totalCount = entry.closedCount + entry.redCount;

  return {
    key: entry.date,
    label: formatShortDate(date),
    tooltip: formatFullDate(date),
    closedCount: entry.closedCount,
    redCount: entry.redCount,
    totalCount,
    isEmpty: totalCount === 0
  };
}

function groupEntriesByWeek(entries: TimelineEntry[], buckets: number): TimelineChartPoint[] {
  if (entries.length === 0) {
    return [];
  }

  const bucketSize = Math.max(1, Math.floor(entries.length / buckets));

  return Array.from({ length: buckets }, (_, index) => {
    const startIndex = index * bucketSize;
    const endIndex = startIndex + bucketSize;
    const bucketEntries = entries.slice(startIndex, endIndex);
    const bucketStart = new Date(`${bucketEntries[0]?.date ?? entries[0].date}T00:00:00`);
    const bucketEnd = new Date(`${bucketEntries.at(-1)?.date ?? entries.at(-1)?.date ?? entries[0].date}T00:00:00`);
    const closedCount = bucketEntries.reduce((sum, entry) => sum + entry.closedCount, 0);
    const redCount = bucketEntries.reduce((sum, entry) => sum + entry.redCount, 0);
    const totalCount = closedCount + redCount;

    return {
      key: bucketEntries[0]?.date ?? `${index}`,
      label: formatShortDate(bucketStart),
      tooltip: `${formatFullDate(bucketStart)} - ${formatFullDate(bucketEnd)}`,
      closedCount,
      redCount,
      totalCount,
      isEmpty: totalCount === 0
    };
  });
}

function buildWeeklyTimeline(events: TimelineEvent[], currentWeekStart: Date, weeks: number): ProgressTimelinePoint[] {
  const start = addDays(currentWeekStart, -7 * (weeks - 1));

  return Array.from({ length: weeks }, (_, index) => {
    const bucketStart = addDays(start, index * 7);
    const bucketEnd = addDays(bucketStart, 7);
    const bucketEvents = events.filter((event) => isWithinRange(event.updatedAt, bucketStart, bucketEnd));
    const bucketLastDay = addDays(bucketEnd, -1);

    return {
      key: bucketStart.toISOString(),
      label: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(bucketStart),
      tooltip: `${formatTooltipDate(bucketStart)} - ${formatTooltipDate(bucketLastDay)}`,
      solved: bucketEvents.filter(isSolvedEvent).length,
      review: bucketEvents.filter(isReviewEvent).length
    };
  });
}

function countSolved(events: TimelineEvent[], start: Date, end: Date) {
  return events.filter((event) => isWithinRange(event.updatedAt, start, end) && isSolvedEvent(event)).length;
}

function countReview(events: TimelineEvent[], start: Date, end: Date) {
  return events.filter((event) => isWithinRange(event.updatedAt, start, end) && isReviewEvent(event)).length;
}

function isSolvedEvent(event: TimelineEvent) {
  return event.status === HomeworkNumberStatus.GREEN || event.status === HomeworkNumberStatus.YELLOW;
}

function isReviewEvent(event: TimelineEvent) {
  return event.status === HomeworkNumberStatus.RED;
}

function isWithinRange(value: Date, start: Date, end: Date) {
  return value >= start && value < end;
}

function parseTimelineDate(value?: Date | string | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short"
  }).format(value);
}

function formatFullDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(value);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + diff);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatTooltipDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long"
  }).format(value);
}
