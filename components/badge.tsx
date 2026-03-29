import { ReactNode } from "react";
import { cx } from "@/lib/utils";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {children}
    </span>
  );
}
