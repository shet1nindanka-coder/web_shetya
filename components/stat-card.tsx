import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: ReactNode;
  className?: string;
  stagger?: number;
};

export function StatCard({ label, value, hint, accent, className, stagger }: StatCardProps) {
  const staggerClass = stagger && stagger >= 1 && stagger <= 6 ? `ui-stagger-${stagger}` : undefined;

  return (
    <article
      className={cx(
        "ui-stat-card ui-fade-slide ui-surface rounded-[8px] border p-3.5 sm:rounded-[10px] sm:p-4 lg:rounded-[12px]",
        staggerClass,
        className
      )}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="ui-stat-card-label ui-copy-muted text-xs font-medium sm:text-sm">{label}</p>
          <p className="ui-stat-card-value font-display text-[1.35rem] font-semibold leading-none text-[var(--theme-text-strong)] sm:text-[1.5rem] lg:text-[1.65rem]">
            {value}
          </p>
          {hint ? <p className="ui-hint ui-copy-muted text-xs leading-relaxed sm:text-sm">{hint}</p> : null}
        </div>
        {accent ? <div className="border-t border-[var(--theme-border-soft)] pt-3 text-sm">{accent}</div> : null}
      </div>
    </article>
  );
}
