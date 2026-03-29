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
        "ui-fade-slide ui-surface rounded-[28px] border border-slate-200/80 bg-white/94 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur",
        className
      )}
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="font-display text-[1.65rem] font-semibold text-slate-950">{title}</h2>
          {description ? <p className="max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
