"use client";

import { useMemo, useState, useTransition } from "react";
import {
  buildProgressTimelineView,
  type TimelineEntry,
  type TimelinePeriod
} from "@/lib/progress-timeline";
import { cx } from "@/lib/utils";

type ProgressTimelineChartProps = {
  entries: TimelineEntry[];
  selectedStudentName?: string | null;
};

const PERIOD_OPTIONS: Array<{ key: TimelinePeriod; label: string }> = [
  { key: "7d", label: "7 дней" },
  { key: "4w", label: "4 недели" },
  { key: "8w", label: "8 недель" }
];

export function ProgressTimelineChart({
  entries,
  selectedStudentName
}: ProgressTimelineChartProps) {
  const [period, setPeriod] = useState<TimelinePeriod>("7d");
  const [activePointKey, setActivePointKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const view = useMemo(() => buildProgressTimelineView(entries, period), [entries, period]);
  const plotMaxValue = Math.max(
    1,
    ...view.points.map((point) => Math.max(point.closedCount, point.redCount, point.totalCount)),
    Math.ceil(view.averagePerPoint)
  );
  const averageOffset = Math.max(8, 100 - (Math.max(view.averagePerPoint, 0) / plotMaxValue) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="ui-tab-shell ui-tab-strip inline-flex w-full flex-wrap gap-1.5 rounded-[14px] p-1.5 sm:w-auto">
            {PERIOD_OPTIONS.map((option) => {
              const isActive = option.key === period;

              return (
                <button
                  key={option.key}
                  type="button"
                  className={cx(
                    "ui-pressable ui-tab rounded-[12px] px-4 py-2 text-sm font-medium transition-all duration-200",
                    isPending && "opacity-70"
                  )}
                  data-active={isActive}
                  aria-pressed={isActive}
                  onClick={() => {
                    if (option.key === period) {
                      return;
                    }

                    startTransition(() => {
                      setActivePointKey(null);
                      setPeriod(option.key);
                    });
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm leading-relaxed text-[var(--theme-text-muted)]">
            {selectedStudentName
              ? `Показываем динамику только для ученика ${selectedStudentName}.`
              : "Показываем общий темп по всем ученикам за выбранный период."}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-sm font-semibold text-[var(--theme-text-strong)]">
            {view.totalChanges} изменений за период
          </p>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <TimelineLegendBadge label="Закрыто" value={view.closedTotal} tone="closed" />
            <TimelineLegendBadge label="Красных" value={view.redTotal} tone="review" />
          </div>
          <TrendBadge direction={view.trend.direction} label={view.trend.label} />
        </div>
      </div>

      <div key={period} className="progress-timeline-stage rounded-[18px] border border-[var(--theme-border-soft)] bg-[linear-gradient(180deg,var(--theme-surface-soft),var(--theme-surface-strong))] px-3 py-4 sm:px-4 sm:py-5">
        <div className="flex flex-col gap-2 border-b border-[var(--theme-border-soft)] pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-display text-[1.05rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.15rem]">
              {view.title}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--theme-text-muted)]">
              {view.description}
            </p>
          </div>

          <div className="rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text-muted)]">
            Среднее: {formatAverage(view.averagePerPoint)} изменения за период
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[620px] sm:min-w-0">
            <div className="relative pb-14">
              <div className="pointer-events-none absolute inset-x-0 top-0 bottom-10">
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--theme-border-soft)]" />
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--theme-border-soft)]" />
                <div
                  className="absolute inset-x-0 progress-timeline-average-line"
                  style={{ top: `${averageOffset}%` }}
                >
                  <span className="absolute -top-5 right-0 rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--theme-text-muted)]">
                    среднее {formatAverage(view.averagePerPoint)}
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 border-t-2 border-[var(--theme-border)]" />
              </div>

              <div
                className="grid items-end gap-2 sm:gap-3"
                style={{ gridTemplateColumns: `repeat(${view.points.length}, minmax(0, 1fr))` }}
              >
                {view.points.map((point, index) => {
                  const showMobileLabel =
                    view.points.length <= 4 || index % 2 === 0 || index === view.points.length - 1;
                  const isActive = activePointKey === point.key;

                  return (
                    <div key={point.key} className="relative min-w-0">
                      {isActive ? (
                        <div className="progress-timeline-tooltip absolute inset-x-1 top-0 z-20 -translate-y-[calc(100%+0.5rem)] rounded-[14px] px-3 py-2 text-left shadow-[var(--theme-shadow-hover)]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--theme-text-soft)]">
                            {point.tooltip}
                          </p>
                          <div className="mt-2 grid gap-1 text-sm text-[var(--theme-text-default)]">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[var(--theme-accent)]" />
                              Закрыто: {point.closedCount}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                              Красных: {point.redCount}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className="group flex h-56 w-full flex-col justify-end bg-transparent p-0 text-left"
                        onMouseEnter={() => setActivePointKey(point.key)}
                        onMouseLeave={() => setActivePointKey((current) => (current === point.key ? null : current))}
                        onFocus={() => setActivePointKey(point.key)}
                        onBlur={() => setActivePointKey((current) => (current === point.key ? null : current))}
                        aria-label={`${point.tooltip}: закрыто ${point.closedCount}, красных ${point.redCount}`}
                      >
                        <div className="relative flex h-44 items-end justify-center gap-1.5 rounded-[18px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)]/75 px-2 pb-3 pt-5 transition-all duration-200 group-hover:border-[var(--theme-accent-border)] group-hover:bg-[var(--theme-surface-strong)] group-focus-visible:border-[var(--theme-accent-border)] group-focus-visible:bg-[var(--theme-surface-strong)]">
                          <div className="absolute inset-x-3 bottom-2 h-px bg-[var(--theme-border)]" />
                          {point.isEmpty ? (
                            <span className="progress-timeline-empty-dot absolute bottom-[7px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full" />
                          ) : (
                            <>
                              <TimelineBar value={point.closedCount} maxValue={plotMaxValue} tone="closed" />
                              <TimelineBar value={point.redCount} maxValue={plotMaxValue} tone="review" />
                            </>
                          )}
                        </div>

                        <div className="mt-2 px-1 text-center">
                          <p
                            className={cx(
                              "truncate text-[11px] font-semibold text-[var(--theme-text-strong)] sm:text-xs",
                              !showMobileLabel && "max-sm:invisible"
                            )}
                          >
                            {point.label}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineLegendBadge({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "closed" | "review";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        tone === "closed" &&
          "border-brand-200/80 bg-brand-50/80 text-brand-700 dark:border-brand-400/20 dark:bg-brand-500/10 dark:text-brand-200",
        tone === "review" &&
          "border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200"
      )}
    >
      <span
        className={cx(
          "h-2.5 w-2.5 rounded-full",
          tone === "closed" && "bg-[var(--theme-accent)]",
          tone === "review" && "bg-rose-400"
        )}
      />
      {label}: {value}
    </span>
  );
}

function TrendBadge({
  direction,
  label
}: {
  direction: "up" | "down" | "flat";
  label: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        direction === "up" &&
          "border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
        direction === "down" &&
          "border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-200",
        direction === "flat" &&
          "border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
      )}
    >
      <span aria-hidden="true">
        {direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}
      </span>
      {label}
    </span>
  );
}

function TimelineBar({
  value,
  maxValue,
  tone
}: {
  value: number;
  maxValue: number;
  tone: "closed" | "review";
}) {
  const normalizedHeight = value <= 0 ? 0 : Math.max(16, Math.round((value / maxValue) * 100));

  if (value <= 0) {
    return <div className="w-4 sm:w-5" aria-hidden="true" />;
  }

  return (
    <div className="relative flex h-full w-4 items-end justify-center sm:w-5">
      <div
        className={cx(
          "progress-timeline-bar relative z-10 w-full transition-all duration-300 ease-out",
          tone === "closed" ? "progress-timeline-bar--closed" : "progress-timeline-bar--review"
        )}
        style={{ height: `${normalizedHeight}%` }}
      />
    </div>
  );
}

function formatAverage(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(".", ",");
}
