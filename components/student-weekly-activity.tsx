import { SectionCard } from "@/components/section-card";
import type { StudentStreak } from "@/lib/student-streak";

type StudentWeeklyActivityProps = {
  streak: StudentStreak;
};

export function StudentWeeklyActivity({ streak }: StudentWeeklyActivityProps) {
  const maxCount = Math.max(1, ...streak.dailyActivity.map((d) => d.count));
  const currentStreakLabel =
    streak.currentStreak > 0 ? `${streak.currentStreak} ${formatDaysLabel(streak.currentStreak)} подряд` : "Пока без серии";
  const currentStreakHint =
    streak.currentStreak > 0
      ? "Серия держится, пока каждый день закрывается хотя бы один номер."
      : "Закройте хотя бы один номер сегодня, чтобы запустить стрик.";
  const bestStreakLabel =
    streak.bestStreak > 0 ? `${streak.bestStreak} ${formatDaysLabel(streak.bestStreak)}` : "Пока нет";
  const solvedTodayLabel =
    streak.solvedToday > 0 ? `${streak.solvedToday} ${formatSolvedLabel(streak.solvedToday)}` : "Без закрытых номеров";

  return (
    <SectionCard title="Стрик и активность" description="Дни подряд считаются по дням, когда вы закрывали хотя бы один номер.">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div className="ui-card-soft rounded-[18px] px-4 py-4">
            <p className="ui-kicker">Сейчас</p>
            <p className="mt-2 font-display text-[1.6rem] font-semibold leading-none text-[var(--theme-text-strong)] sm:text-[1.85rem]">
              {currentStreakLabel}
            </p>
            <p className="ui-hint mt-2 text-sm leading-relaxed text-[var(--theme-text-muted)]">
              {currentStreakHint}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="ui-card-soft rounded-[16px] px-4 py-3.5">
              <p className="ui-kicker">Лучший ритм</p>
              <p className="mt-2 font-display text-[1.25rem] font-semibold text-[var(--theme-text-strong)]">
                {bestStreakLabel}
              </p>
            </div>
            <div className="ui-card-soft rounded-[16px] px-4 py-3.5">
              <p className="ui-kicker">Сегодня</p>
              <p className="mt-2 font-display text-[1.25rem] font-semibold text-[var(--theme-text-strong)]">
                {solvedTodayLabel}
              </p>
            </div>
            <div className="ui-card-soft rounded-[16px] px-4 py-3.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="ui-kicker">За неделю</p>
                  <p className="mt-2 font-display text-[1.25rem] font-semibold text-[var(--theme-text-strong)]">
                    {streak.solvedThisWeek} {formatSolvedLabel(streak.solvedThisWeek)}
                  </p>
                </div>
                <span className="inline-flex rounded-full border border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--theme-accent-text)]">
                  Последние 7 дней
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ui-panel-soft rounded-[18px] px-4 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="ui-kicker">По дням</p>
              <p className="mt-1 text-sm text-[var(--theme-text-muted)]">Сколько номеров получилось закрыть за каждый день.</p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-1.5 sm:gap-2" style={{ height: 118 }}>
            {streak.dailyActivity.map((day) => {
              const heightPercent = maxCount > 0 ? Math.max(day.count > 0 ? 12 : 4, (day.count / maxCount) * 100) : 4;
              const isToday = day.date === streak.dailyActivity.at(-1)?.date;

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
