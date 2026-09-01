// Статус урока — производная от расписания, а не хранимое состояние:
// до startsAt урок «Запланирован», в интервале startsAt…startsAt+duration —
// «Идёт», после — «Завершён». У урока без даты остаётся статус из БД
// (исторические уроки и ручные сборки без расписания).
// Единственное перекрытие: finishedAt — учитель завершил урок досрочно,
// расписание после этого не имеет значения.

export type DerivedLessonStatus = "PLANNED" | "ACTIVE" | "FINISHED";

const KNOWN_STATUSES: DerivedLessonStatus[] = ["PLANNED", "ACTIVE", "FINISHED"];

export function deriveLessonStatus(
  lesson: {
    startsAt: Date | string | null;
    durationMinutes: number;
    status: string;
    finishedAt?: Date | string | null;
  },
  now: number = Date.now()
): DerivedLessonStatus {
  if (lesson.finishedAt) {
    const finished = new Date(lesson.finishedAt).getTime();

    if (Number.isFinite(finished) && finished <= now) {
      return "FINISHED";
    }
  }

  const start = lesson.startsAt ? new Date(lesson.startsAt).getTime() : Number.NaN;

  if (!Number.isFinite(start)) {
    return KNOWN_STATUSES.includes(lesson.status as DerivedLessonStatus)
      ? (lesson.status as DerivedLessonStatus)
      : "PLANNED";
  }

  if (now < start) {
    return "PLANNED";
  }

  const durationMs = Math.max(0, lesson.durationMinutes) * 60_000;

  if (now < start + durationMs) {
    return "ACTIVE";
  }

  return "FINISHED";
}
