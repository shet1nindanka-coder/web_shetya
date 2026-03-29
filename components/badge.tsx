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
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm",
        className
      )}
    >
      {children}
    </span>
  );
}
