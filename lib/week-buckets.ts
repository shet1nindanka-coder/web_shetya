/*
 * Недельные корзины для графиков «сколько занятий по неделям».
 * Чистая логика без БД. Работает в локальной таймзоне процесса —
 * приложение живёт с TZ=Europe/Moscow (см. CLAUDE.md), поэтому границы
 * недель совпадают с московскими понедельниками.
 */

export type WeekBucket = {
  /** Понедельник 00:00 локального времени. */
  start: Date;
  /** Следующий понедельник 00:00 (эксклюзивно). */
  end: Date;
};

/** Понедельник 00:00 локальной таймзоны для переданной даты. */
export function mondayOf(date: Date): Date {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (local.getDay() + 6) % 7; // 0 = понедельник
  local.setDate(local.getDate() - weekday);
  return local;
}

/** Последние `count` недель, включая текущую; от старой к новой. */
export function buildWeekBuckets(now: Date, count: number): WeekBucket[] {
  const currentMonday = mondayOf(now);
  const buckets: WeekBucket[] = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(currentMonday);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    buckets.push({ start, end });
  }

  return buckets;
}

/** Раскладывает даты по корзинам; даты вне диапазона не считаются. */
export function countByWeek(dates: Date[], buckets: WeekBucket[]): number[] {
  const counts = buckets.map(() => 0);

  for (const date of dates) {
    const time = date.getTime();

    for (let index = 0; index < buckets.length; index += 1) {
      if (time >= buckets[index].start.getTime() && time < buckets[index].end.getTime()) {
        counts[index] += 1;
        break;
      }
    }
  }

  return counts;
}
