import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  className
}: SectionCardProps) {
  return (
    <section
      className={cx(
        "ui-fade-slide ui-surface relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.92))] p-6 shadow-[0_18px_46px_rgba(15,23,42,0.075)] backdrop-blur",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-200 to-transparent" />
      <div className="pointer-events-none absolute -left-10 top-0 h-32 w-32 rounded-full bg-brand-100/45 blur-3xl" />
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100/90 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="font-display text-[1.9rem] font-semibold text-slate-950">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
