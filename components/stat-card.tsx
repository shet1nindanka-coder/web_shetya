import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, hint, accent, className }: StatCardProps) {
  return (
    <article
      className={cx(
        "ui-stat-card ui-fade-slide ui-surface rounded-[18px] border p-4 sm:rounded-[20px] sm:p-[1.125rem] lg:rounded-[22px] lg:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="ui-stat-card-label ui-copy-muted text-sm font-medium">{label}</p>
          <p className="ui-stat-card-value font-display text-[1.6rem] font-semibold leading-none text-[var(--theme-text-strong)] sm:text-[1.75rem] lg:text-[1.9rem]">
            {value}
          </p>
          {hint ? <p className="ui-hint ui-copy-muted text-sm leading-6">{hint}</p> : null}
        </div>
        {accent ? <div className="ui-copy-soft text-right text-sm">{accent}</div> : null}
      </div>
    </article>
  );
}
