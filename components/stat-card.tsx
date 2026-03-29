import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  hint: string;
  accent?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, hint, accent, className }: StatCardProps) {
  return (
    <article
      className={cx(
        "ui-fade-slide ui-surface rounded-[20px] border border-slate-200/80 bg-white/94 p-4 shadow-[0_12px_28px_rgba(15,23,42,0.045)] backdrop-blur sm:rounded-[22px] sm:p-5 lg:rounded-[24px]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="font-display text-[1.6rem] font-semibold leading-none text-slate-950 sm:text-[1.75rem] lg:text-[1.9rem]">
            {value}
          </p>
          <p className="text-sm leading-6 text-slate-500">{hint}</p>
        </div>
        {accent ? <div className="text-right text-sm text-slate-400">{accent}</div> : null}
      </div>
    </article>
  );
}
