"use client";

import { SectionCard } from "@/components/section-card";
import { StudentStreakBadge } from "@/components/student-streak-badge";
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
  const motionState = useStreakMotion(currentStreak.currentStreak);
  const maxCount = Math.max(1, ...currentStreak.dailyActivity.map((d) => d.count));
  const streakColorMeta = getStudentStreakColorMeta(currentStreak.currentStreak);
  const solvedTodayLabel =
    currentStreak.solvedToday > 0
      ? `${currentStreak.solvedToday} ${formatSolvedLabel(currentStreak.solvedToday)}`
      : "Без закрытых номеров";
  const goalTitle = streakColorMeta.nextThreshold
    ? `${streakColorMeta.nextThreshold} ${formatDaysLabel(streakColorMeta.nextThreshold)}`
    : "Максимальный цвет";
  const goalHint =
    streakColorMeta.nextThreshold && streakColorMeta.daysToNextThreshold !== null
      ? currentStreak.currentStreak > 0
        ? `До нового цвета осталось ${streakColorMeta.daysToNextThreshold} ${formatDaysLabel(streakColorMeta.daysToNextThreshold)}.`
        : `Первый цвет откроется на ${streakColorMeta.nextThreshold}-м дне.`
      : "Вы уже открыли последний цветовой уровень.";
  const streakHeadline =
    currentStreak.currentStreak > 0
      ? `${currentStreak.currentStreak} ${formatDaysLabel(currentStreak.currentStreak)} подряд`
      : "Зажгите первый день";
  const streakHint =
    currentStreak.solvedToday > 0
      ? "Сегодняшний шаг уже засчитан — огонек сохранён."
      : currentStreak.currentStreak > 0
        ? "Закройте хотя бы один номер сегодня, чтобы серия не оборвалась."
        : "Закройте хотя бы один номер сегодня, и огонек начнётся.";

  return (
    <SectionCard title="Огонек и ритм" description="Стрик держится, пока каждый день закрывается хотя бы один номер.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-3">
          <div
            className="student-streak-hero rounded-[22px] border px-4 py-4 sm:px-5 sm:py-5"
            data-streak-animate={motionState ?? undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="ui-kicker text-[var(--theme-text-soft)]">Огонек</p>
                <h3 className="font-display text-[1.65rem] font-semibold leading-none text-[var(--theme-text-strong)] sm:text-[1.95rem]">
                  {streakHeadline}
                </h3>
              </div>
                <StudentStreakBadge currentStreak={currentStreak.currentStreak} size="md" className="shrink-0" />
            </div>
            <p className="ui-hint mt-3 max-w-lg text-sm leading-relaxed text-[var(--theme-text-muted)]">
              {streakHint}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="ui-card-soft rounded-[18px] px-4 py-4">
              <p className="ui-kicker">Сегодня сделано</p>
              <p className="mt-2 font-display text-[1.3rem] font-semibold text-[var(--theme-text-strong)]">
                {solvedTodayLabel}
              </p>
            </div>
            <div className="ui-card-soft rounded-[18px] px-4 py-4">
              <p className="ui-kicker">Следующая цель</p>
              <p className="mt-2 font-display text-[1.3rem] font-semibold text-[var(--theme-text-strong)]">{goalTitle}</p>
              <p className="ui-hint mt-2 text-sm text-[var(--theme-text-muted)]">{goalHint}</p>
            </div>
          </div>
        </div>

        <div className="ui-panel-soft rounded-[18px] px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="ui-kicker">За неделю</p>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
                {currentStreak.solvedThisWeek} {formatSolvedLabel(currentStreak.solvedThisWeek)} закрыто за последние 7 дней.
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-1.5 sm:gap-2" style={{ height: 118 }}>
            {currentStreak.dailyActivity.map((day) => {
              const heightPercent = maxCount > 0 ? Math.max(day.count > 0 ? 12 : 4, (day.count / maxCount) * 100) : 4;
              const isToday = day.date === currentStreak.dailyActivity.at(-1)?.date;

              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span
                    className={
                      day.count > 0
                        ? "text-[11px] font-semibold text-[var(--theme-text-strong)]"
                        : "text-[11px] text-[var(--theme-text-soft)]"
                    }
                  >
                    {day.count > 0 ? day.count : ""}
                  </span>
                  <div
                    className="flex h-full w-full items-end rounded-[10px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] px-1.5 py-1.5"
                  >
                    <div
                      className="w-full rounded-[7px] transition-all duration-300 sm:rounded-[8px]"
                      style={{
                        height: `${heightPercent}%`,
                        minHeight: day.count > 0 ? 8 : 3,
                        background: day.count > 0
                          ? isToday
                            ? "linear-gradient(180deg, color-mix(in srgb, var(--theme-accent) 72%, white 28%), var(--theme-accent))"
                            : "linear-gradient(180deg, color-mix(in srgb, var(--theme-accent-soft) 35%, white 65%), var(--theme-accent-soft))"
                          : "var(--theme-border-soft)"
                      }}
                    />
                  </div>
                  <span
                    className={
                      isToday
                        ? "text-[11px] font-semibold text-[var(--theme-accent-text)]"
                        : "text-[11px] text-[var(--theme-text-muted)]"
                    }
                  >
                    {day.dayLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
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
