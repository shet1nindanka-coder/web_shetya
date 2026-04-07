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
    <section className={cx("ui-page-header ui-surface rounded-[18px] border p-5 sm:rounded-[20px] sm:p-6 lg:rounded-[22px]", className)}>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="space-y-3">
            {backHref && backLabel ? (
              <Link href={backHref} className="inline-flex text-sm font-semibold text-brand-700 transition hover:text-brand-900">
                {backLabel}
              </Link>
            ) : null}

            {eyebrow ? <p className="ui-kicker">{eyebrow}</p> : null}

            <div className="space-y-2">
              <h1 className="font-display text-[2rem] font-semibold leading-tight text-[var(--theme-text-strong)] sm:text-[2.25rem]">
                {title}
              </h1>
              {description ? (
                <p className="ui-hint max-w-3xl text-sm leading-6 text-[var(--theme-text-muted)] sm:text-[0.95rem] sm:leading-7">
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          {metrics?.length ? (
            <div className="ui-page-header-metrics flex flex-wrap gap-2.5">
              {metrics.map((metric) => (
                <div key={metric.label} className={metricToneClassNames[metric.tone ?? "default"]}>
                  <span className="ui-metric-pill-label">{metric.label}</span>
                  <span className="ui-metric-pill-value">{metric.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        {aside ? <div className="ui-page-header-aside w-full xl:w-[320px] xl:flex-none">{aside}</div> : null}
      </div>
    </section>
  );
}
