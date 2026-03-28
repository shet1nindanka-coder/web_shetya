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
        "relative overflow-hidden rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-glow backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-gold to-accent-mint" />
      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-brand-100/50 blur-3xl" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className="font-display text-3xl font-semibold text-slate-950">{value}</p>
          <p className="text-sm leading-6 text-slate-600">{hint}</p>
        </div>
        {accent ? <div className="text-right text-sm text-slate-500">{accent}</div> : null}
      </div>
    </article>
  );
}
