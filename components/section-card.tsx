import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({ title, description, action, children, className }: SectionCardProps) {
  return (
    <section className={className}>
      <div className={cx("flex flex-wrap items-end justify-between gap-4", description ? "mb-3" : "mb-[18px]")}>
        <div className="min-w-0">
          <h2 className="shbz-section-title" style={{ marginBottom: 0 }}>
            {title}
          </h2>
          {description ? (
            <p className="ui-hint mt-1.5 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cx("shbz-card shbz-section-pad", description ? "mt-[18px]" : undefined)}>{children}</div>
    </section>
  );
}
