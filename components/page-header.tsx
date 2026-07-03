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

const metricToneColors: Record<PageHeaderMetricTone, string> = {
  default: "var(--shbz-text-strong)",
  accent: "var(--shbz-accent-solid)",
  success: "var(--shbz-green-text)",
  warning: "var(--shbz-yellow-text)",
  danger: "var(--shbz-red-text)"
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
    <section className={cx("mb-9", className)}>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          {backHref && backLabel ? (
            <Link
              href={backHref}
              className="mb-3 inline-block text-sm font-semibold transition-colors"
              style={{ color: "var(--shbz-text-muted)" }}
            >
              {backLabel}
            </Link>
          ) : null}

          {eyebrow ? <p className="shbz-kicker">{eyebrow}</p> : null}

          <h1
            className="mt-2.5 flex items-baseline gap-3 text-[clamp(24px,4vw,34px)] font-extrabold leading-tight tracking-[-0.8px]"
            style={{ color: "var(--shbz-text-strong)" }}
          >
            <span className="min-w-0">{title}</span>
            <span className="shbz-dot h-2.5 w-2.5 shrink-0 self-center" />
          </h1>

          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
              {description}
            </p>
          ) : null}

          {metrics?.length ? (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {metrics.map((metric) => (
                <div key={metric.label} className="ui-metric-pill flex items-baseline gap-2 px-3.5 py-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--shbz-kicker)" }}>
                    {metric.label}
                  </span>
                  <span className="text-sm font-extrabold" style={{ color: metricToneColors[metric.tone ?? "default"] }}>
                    {metric.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {actions ? <div className="mt-5 flex flex-wrap gap-2.5">{actions}</div> : null}
        </div>

        {aside ? <div className="w-full xl:w-[300px] xl:flex-none">{aside}</div> : null}
      </div>
    </section>
  );
}
