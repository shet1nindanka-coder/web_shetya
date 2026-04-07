import Link from "next/link";
import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type PageHeaderMetricTone = "default" | "accent" | "success" | "warning" | "danger";

type PageHeaderMetric = {
  label: string;
  value: ReactNode;
  tone?: PageHeaderMetricTone;
};

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  metrics?: PageHeaderMetric[];
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

const metricToneClassNames: Record<PageHeaderMetricTone, string> = {
  default: "ui-metric-pill",
  accent: "ui-metric-pill ui-metric-pill-accent",
  success: "ui-metric-pill ui-metric-pill-success",
  warning: "ui-metric-pill ui-metric-pill-warning",
  danger: "ui-metric-pill ui-metric-pill-danger"
};

export function PageHeader({
  eyebrow,
  title,
  description,
  metrics,
  backHref,
  backLabel,
  actions,
  aside,
  className
}: PageHeaderProps) {
  return (
    <section className={cx("ui-page-header ui-surface rounded-[14px] border p-3.5 sm:rounded-[18px] sm:p-5 lg:rounded-[20px]", className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-2">
            {backHref && backLabel ? (
              <Link href={backHref} className="inline-flex text-sm font-semibold text-brand-700 transition hover:text-brand-900">
                {backLabel}
              </Link>
            ) : null}

            {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}

            <div className="space-y-1.5">
              <h1 className="font-display text-[1.5rem] font-semibold leading-tight text-[var(--theme-text-strong)] sm:text-[1.75rem] lg:text-[2rem]">
                {title}
              </h1>
              {description ? (
                <p className="ui-hint max-w-2xl text-sm leading-relaxed text-[var(--theme-text-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {metrics?.length ? (
            <div className="ui-page-header-metrics flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <div key={metric.label} className={metricToneClassNames[metric.tone ?? "default"]}>
                  <span className="ui-metric-pill-label">{metric.label}</span>
                  <span className="ui-metric-pill-value">{metric.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
        </div>

        {aside ? <div className="ui-page-header-aside w-full xl:w-[300px] xl:flex-none">{aside}</div> : null}
      </div>
    </section>
  );
}
