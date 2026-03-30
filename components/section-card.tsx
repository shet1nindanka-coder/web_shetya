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
        "ui-fade-slide ui-surface rounded-[22px] border border-slate-200/80 bg-white/94 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] sm:rounded-[24px] sm:p-5 lg:rounded-[28px] lg:p-6",
        className
      )}
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:mb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.5rem] lg:text-[1.65rem]">
            {title}
          </h2>
          {description ? <p className="ui-hint max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
