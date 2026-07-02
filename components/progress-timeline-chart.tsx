"use client";

import { useMemo, useState, useTransition } from "react";
import {
  buildProgressTimelineView,
  type TimelineEntry,
  type TimelinePeriod
} from "@/lib/progress-timeline";

type ProgressTimelineChartProps = {
  entries: TimelineEntry[];
  selectedStudentName?: string | null;
};

const PERIOD_OPTIONS: Array<{ key: TimelinePeriod; label: string }> = [
  { key: "7d", label: "7 дней" },
  { key: "4w", label: "4 недели" },
  { key: "8w", label: "8 недель" }
];

type ChartPoint = {
  cx: number;
  cy: number;
  label: string;
  value: number;
};

function buildChart(values: number[], labels: string[]) {
  const padL = 24;
  const padT = 24;
  const base = 210;
  const innerWidth = 1052;
  const innerHeight = 186;
  const maxValue = Math.max(1, ...values);
  const count = values.length;

  const points: ChartPoint[] = values.map((value, index) => {
    const cx = count === 1 ? padL + innerWidth / 2 : padL + (innerWidth * index) / (count - 1);
    const cy = padT + innerHeight * (1 - value / maxValue);
    return { cx: Number(cx.toFixed(1)), cy: Number(cy.toFixed(1)), label: labels[index] ?? "", value };
  });

  const line = "M " + points.map((point) => `${point.cx} ${point.cy}`).join(" L ");
  const area = `${line} L ${points[count - 1]!.cx} ${base} L ${points[0]!.cx} ${base} Z`;

  return { points, line, area };
}

export function ProgressTimelineChart({ entries, selectedStudentName }: ProgressTimelineChartProps) {
  const [period, setPeriod] = useState<TimelinePeriod>("7d");
  const [isPending, startTransition] = useTransition();

  const view = useMemo(() => buildProgressTimelineView(entries, period), [entries, period]);
  const chart = useMemo(() => {
    if (view.points.length === 0) {
      return null;
    }

    return buildChart(
      view.points.map((point) => point.closedCount),
      view.points.map((point) => point.label)
    );
  }, [view]);

  const trendArrow = view.trend.direction === "up" ? "↑" : view.trend.direction === "down" ? "↓" : "→";

  return (
    <div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-5">
        <div className="shbz-seg" style={{ opacity: isPending ? 0.7 : 1 }}>
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="shbz-seg-btn shbz-seg-btn--plain"
              data-active={option.key === period}
              aria-pressed={option.key === period}
              onClick={() => {
                if (option.key === period) {
                  return;
                }

                startTransition(() => setPeriod(option.key));
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-[7px]"
              style={{ background: "var(--shbz-green-soft)" }}
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--shbz-accent-solid)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Закрыто:
              </span>
              <span className="text-[13px] font-extrabold" style={{ color: "var(--shbz-accent-solid)" }}>
                {view.closedTotal}
              </span>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-[7px]"
              style={{ background: "var(--shbz-red-soft)" }}
            >
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: "var(--shbz-danger-solid)" }} />
              <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Красных:
              </span>
              <span className="text-[13px] font-extrabold" style={{ color: "var(--shbz-danger-solid)" }}>
                {view.redTotal}
              </span>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            <span style={{ color: "var(--shbz-accent-solid)" }}>{trendArrow}</span>
            {view.trend.label}
          </div>
        </div>
      </div>

      <p className="ui-hint mb-4 text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
        {selectedStudentName
          ? `Показываем динамику только для ученика ${selectedStudentName}.`
          : "Показываем общий темп по всем ученикам за выбранный период."}
      </p>

      <div
        className="rounded-2xl border p-6"
        style={{ background: "var(--shbz-panel-bg)", borderColor: "var(--shbz-soft-border)" }}
      >
        <div className="mb-3.5 text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          {view.title}
        </div>

        {chart ? (
          <svg viewBox="0 0 1100 240" preserveAspectRatio="xMidYMid meet" className="block h-[240px] w-full">
            <defs>
              <linearGradient id="shbzChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(54,224,164,0.26)" />
                <stop offset="100%" stopColor="rgba(54,224,164,0)" />
              </linearGradient>
            </defs>
            <line x1="24" y1="24" x2="1076" y2="24" stroke="var(--shbz-soft-border)" strokeWidth="1" />
            <line x1="24" y1="117" x2="1076" y2="117" stroke="var(--shbz-soft-border)" strokeWidth="1" />
            <line x1="24" y1="210" x2="1076" y2="210" stroke="var(--shbz-progress-track)" strokeWidth="1" />
            <path d={chart.area} fill="url(#shbzChartGrad)" />
            <path
              d={chart.line}
              fill="none"
              stroke="var(--shbz-accent-solid)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {chart.points.map((point) => (
              <circle
                key={`${point.cx}-${point.label}`}
                cx={point.cx}
                cy={point.cy}
                r="4.5"
                fill="var(--shbz-card-bg)"
                stroke="var(--shbz-accent-solid)"
                strokeWidth="2.5"
              >
                <title>{`${point.label}: закрыто ${point.value}`}</title>
              </circle>
            ))}
            {chart.points.map((point) => (
              <text
                key={`label-${point.cx}-${point.label}`}
                x={point.cx}
                y="232"
                textAnchor="middle"
                fontFamily="inherit"
                fontSize="13"
                fontWeight="600"
                fill="var(--shbz-text-soft)"
              >
                {point.label}
              </text>
            ))}
          </svg>
        ) : (
          <div className="py-10 text-center text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Пока нет данных за выбранный период.
          </div>
        )}
      </div>
    </div>
  );
}
