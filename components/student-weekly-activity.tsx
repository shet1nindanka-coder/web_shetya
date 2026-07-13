"use client";

import type { StudentStreak } from "@/lib/student-streak";
import { getStudentStreakColorMeta } from "@/lib/student-streak-colors";
import { useStudentStreak } from "@/components/student-streak-provider";
import { useStreakMotion } from "@/components/use-streak-motion";

type StudentWeeklyActivityProps = {
  streak: StudentStreak;
};

export function StudentWeeklyActivity({ streak }: StudentWeeklyActivityProps) {
  const liveStreak = useStudentStreak();
  const currentStreak = liveStreak?.streak ?? streak;
  const streakColorMeta = getStudentStreakColorMeta(currentStreak.currentStreak);
  const motionState = useStreakMotion(currentStreak.currentStreak);
  const todayDate = currentStreak.dailyActivity.at(-1)?.date;

  const solvedTodayLabel =
    currentStreak.solvedToday > 0
      ? `${currentStreak.solvedToday} ${formatSolvedLabel(currentStreak.solvedToday)}`
      : "Без закрытых номеров";
  const goalTitle = streakColorMeta.nextThreshold
    ? `${streakColorMeta.nextThreshold} ${formatDaysLabel(streakColorMeta.nextThreshold)}`
    : "Максимальный цвет";
  const streakHeadline =
    currentStreak.currentStreak > 0
      ? `${currentStreak.currentStreak} ${formatDaysLabel(currentStreak.currentStreak)} подряд`
      : "Зажгите первый день";

  return (
    <section>
      <h2 className="shbz-section-title">Огонёк и ритм</h2>
      <div className="shbz-card shbz-section-pad">
        <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="flex flex-col gap-3.5">
            <div className="shbz-streak-hero px-6 py-[22px]" data-animate={motionState ?? undefined}>
              <div className="flex items-start justify-between gap-3">
                <div
                  className="text-[11px] font-bold uppercase tracking-[1.2px]"
                  style={{ color: "var(--shbz-streak-text)" }}
                >
                  Огонёк
                </div>
                <div
                  className="shbz-streak-flame inline-flex items-center gap-1.5 rounded-[8px] px-3 py-1.5"
                  data-animate={motionState ?? undefined}
                  style={{ background: "var(--shbz-streak-pill-bg)" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--shbz-streak-flame)" aria-hidden="true">
                    <path d="M12 2c1 3-1.5 4.5-1.5 7A3.5 3.5 0 0 0 14 12c0-2 1.5-3 1.5-3 1 4 .5 5-.5 7a4 4 0 1 1-7-3.5C9.5 9 11 7 12 2z" />
                  </svg>
                  <span className="shbz-streak-count text-[12.5px] font-extrabold" style={{ color: "var(--shbz-streak-text)" }}>
                    {currentStreak.currentStreak} дн.
                  </span>
                </div>
              </div>
              <div className="mt-3 text-[26px] font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
                {streakHeadline}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="shbz-panel-soft px-5 py-[18px]">
                <div className="text-[11px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
                  Сегодня сделано
                </div>
                <div className="mt-2 text-[17px] font-extrabold leading-[1.25]" style={{ color: "var(--shbz-text-strong)" }}>
                  {solvedTodayLabel}
                </div>
              </div>
              <div className="shbz-panel-soft px-5 py-[18px]">
                <div className="text-[11px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
                  Следующая цель
                </div>
                <div className="mt-2 text-[22px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {goalTitle}
                </div>
              </div>
            </div>
          </div>

          <div
            className="flex flex-col rounded-2xl border p-6"
            style={{ background: "var(--shbz-panel-bg)", borderColor: "var(--shbz-soft-border)" }}
          >
            <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
              За неделю
            </div>
            <div className="mt-2 text-[15px]" style={{ color: "var(--shbz-label)" }}>
              {currentStreak.solvedThisWeek} {formatSolvedLabel(currentStreak.solvedThisWeek)} закрыто за последние 7 дней.
            </div>
            <div className="mt-auto flex items-end justify-between gap-2.5 pt-7">
              {currentStreak.dailyActivity.map((day) => {
                const isToday = day.date === todayDate;
                const dotColor = day.count > 0 ? "var(--shbz-accent-solid)" : "var(--shbz-week-dot-off)";
                const labelColor = isToday ? "var(--shbz-accent-solid)" : "var(--shbz-kicker)";

                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-3">
                    <div
                      className="flex h-16 w-full items-end justify-center rounded-[12px] pb-2"
                      style={{ background: "var(--shbz-week-cell)" }}
                      title={day.count > 0 ? `Закрыто номеров: ${day.count}` : "Нет закрытых номеров"}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: labelColor }}>
                      {day.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDaysLabel(value: number) {
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

function formatSolvedLabel(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "номер";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "номера";
  }

  return "номеров";
}
