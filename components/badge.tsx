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
        "inline-flex items-center rounded-[8px] border px-2.5 py-1 text-[12px] font-medium transition-colors",
        className
      )}
    >
      {children}
    </span>
  );
}
