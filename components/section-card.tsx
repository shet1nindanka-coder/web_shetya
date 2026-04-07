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
        "ui-section-card ui-fade-slide ui-surface rounded-[18px] border p-4 sm:rounded-[20px] sm:p-5 lg:rounded-[22px] lg:p-[1.35rem]",
        className
      )}
    >
      <div className="ui-section-card-header mb-4 flex flex-col gap-3 border-b pb-4 lg:mb-[1.125rem] lg:flex-row lg:items-end lg:justify-between">
        <div className={description ? "space-y-1.5" : undefined}>
          <h2 className="ui-section-card-title font-display text-[1.35rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem] lg:text-[1.65rem]">
            {title}
          </h2>
          {description ? <p className="ui-hint ui-copy-muted max-w-2xl text-sm leading-6">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
