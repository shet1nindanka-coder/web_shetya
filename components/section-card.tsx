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
        "ui-section-card ui-fade-slide ui-surface rounded-[8px] border p-3.5 sm:rounded-[10px] sm:p-4 lg:rounded-[12px] lg:p-5",
        className
      )}
    >
      <div className="ui-section-card-header mb-3.5 flex flex-col gap-2.5 border-b pb-3.5 sm:mb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className={description ? "space-y-1" : undefined}>
          <h2 className="ui-section-card-title font-display text-[1.15rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.3rem] lg:text-[1.45rem]">
            {title}
          </h2>
          {description ? <p className="ui-hint ui-copy-muted max-w-2xl text-sm leading-relaxed">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
