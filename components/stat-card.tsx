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
        "ui-fade-slide ui-surface relative overflow-hidden rounded-[30px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(246,249,255,0.92))] p-6 shadow-[0_18px_44px_rgba(15,23,42,0.075)] backdrop-blur",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-accent-gold to-accent-mint" />
      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-brand-100/55 blur-3xl" />
      <div className="absolute inset-x-5 top-5 h-px bg-gradient-to-r from-white/0 via-white/80 to-white/0" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className="font-display text-[2.1rem] font-semibold leading-none text-slate-950">{value}</p>
          <p className="text-sm leading-6 text-slate-600">{hint}</p>
        </div>
        {accent ? <div className="text-right text-sm text-slate-500">{accent}</div> : null}
      </div>
    </article>
  );
}
