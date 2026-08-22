import Link from "next/link";
import type { GroupMemberRow, GroupStatistics } from "@/lib/group-statistics";
import { cx, formatShortDate } from "@/lib/utils";

/*
 * «Статистика группы» на странице группы: сводные плитки (самый активный,
 * меньше всех активности, закрыто за неделю, кому нужно внимание) и таблица
 * по каждому участнику с переходом в его отчёты PDF — те же, что на странице ученика.
 */

type GroupStatisticsSectionProps = {
  stats: GroupStatistics;
  prefix: string;
};

function SummaryTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="shbz-panel-soft px-5 py-[18px]">
      <div className="text-[12px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      <div className="mt-2 truncate text-[19px] font-extrabold leading-[1.25] tracking-[-0.2px]" style={{ color: "var(--shbz-text-strong)" }}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[12.5px]" style={{ color: "var(--shbz-text-muted)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function activityLabel(row: GroupMemberRow) {
  if (!row.lastActivityAt) return "ещё не начинал";
  if (row.idleDays === 0) return "сегодня";
  if (row.idleDays === 1) return "вчера";
  return formatShortDate(row.lastActivityAt);
}

export function GroupStatisticsSection({ stats, prefix }: GroupStatisticsSectionProps) {
  if (stats.members.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
        Статистика появится, когда в группе будут ученики.
      </p>
    );
  }

  const columns = "md:grid-cols-[minmax(0,1.4fr)_72px_72px_72px_72px_minmax(120px,1fr)_auto]";

  return (
    <div className="space-y-5">
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          label="Самый активный"
          value={stats.mostActive ? stats.mostActive.name : "—"}
          hint={stats.mostActive ? `${stats.mostActive.closed7} за 7 дней · ${stats.mostActive.closed30} за 30` : "пока нет активности"}
        />
        <SummaryTile
          label="Меньше всех активности"
          value={stats.leastActive ? stats.leastActive.name : "—"}
          hint={stats.leastActive ? `${stats.leastActive.closed7} за 7 дней · ${stats.leastActive.closed30} за 30` : undefined}
        />
        <SummaryTile
          label="Закрыто группой"
          value={`${stats.totals.closed7} за 7 дней`}
          hint={`${stats.totals.closed30} за 30 дней · красных ${stats.totals.red30}`}
        />
        <SummaryTile
          label="Нужно внимание"
          value={stats.totals.attentionCount === 0 ? "никому" : `${stats.totals.attentionCount} из ${stats.members.length}`}
          hint={stats.totals.overdueHomeworks > 0 ? `просроченных ДЗ: ${stats.totals.overdueHomeworks}` : "просроченных ДЗ нет"}
        />
      </div>

      <div className="shbz-panel-soft px-5 py-1">
        <div
          className={cx("hidden items-center gap-4 border-b py-3.5 text-[11px] font-bold uppercase tracking-[1.2px] md:grid", columns)}
          style={{ color: "var(--shbz-kicker)", borderColor: "var(--shbz-soft-border)" }}
        >
          <div>Ученик</div>
          <div className="text-center">7 дн.</div>
          <div className="text-center">30 дн.</div>
          <div className="text-center">Красн.</div>
          <div className="text-center">Стрик</div>
          <div>Активность</div>
          <div className="text-right">Отчёт</div>
        </div>

        {stats.members.map((row, index) => (
          <div
            key={row.id}
            className={cx("flex flex-col gap-3 py-4 md:grid md:items-center md:gap-4", columns)}
            style={index < stats.members.length - 1 ? { borderBottom: "1px solid var(--shbz-row-border)" } : undefined}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
                  style={{
                    background: row.rank === 1 && stats.mostActive ? "var(--shbz-accent-grad)" : "var(--shbz-seg-bg)",
                    color: row.rank === 1 && stats.mostActive ? "#fff" : "var(--shbz-seg-text)"
                  }}
                >
                  {row.rank}
                </span>
                <Link
                  href={`${prefix}/students/${row.id}`}
                  className="truncate text-sm font-bold no-underline hover:opacity-75"
                  style={{ color: "var(--shbz-text-strong)" }}
                >
                  {row.name}
                </Link>
              </div>
              {row.attention.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {row.attention.map((flag) => (
                    <span key={flag} className="shbz-chip shbz-chip-yellow" style={{ padding: "3px 9px", fontSize: 11.5 }}>
                      {flag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <Stat value={row.closed7} label="за 7 дн." />
            <Stat value={row.closed30} label="за 30 дн." />
            <Stat value={row.red30} label="красных" tone={row.red30 >= 5 ? "red" : undefined} />
            <Stat value={row.streak} label="стрик" />
            <div className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
              {activityLabel(row)}
              {row.activeHomeworks > 0 ? ` · ДЗ в работе: ${row.activeHomeworks}` : ""}
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <a href={`/teacher/students/${row.id}/export/pdf`} className="shbz-btn-outline no-underline">
                7 дней
              </a>
              <a href={`/teacher/students/${row.id}/export/pdf?period=30d`} className="shbz-btn-outline no-underline">
                30 дней
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: "red" }) {
  return (
    <div className="flex items-baseline gap-1.5 md:block md:text-center">
      <span
        className="text-[17px] font-extrabold"
        style={{ color: tone === "red" ? "var(--shbz-red-text)" : "var(--shbz-text-strong)" }}
      >
        {value}
      </span>
      <span className="text-[12px] md:hidden" style={{ color: "var(--shbz-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}
