import { HomeworkNumberStatus } from "@prisma/client";
import { completionPercent } from "@/lib/utils";

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
  const daily = buildDailyTimeline(events, todayStart, 14);
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
