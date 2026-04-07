import { cx } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ProgressBar({ value, size = "md", className }: ProgressBarProps) {
  const normalizedValue = Math.min(100, Math.max(0, value)) / 100;
  const trackHeight = size === "sm" ? "h-2" : size === "lg" ? "h-3" : "h-2.5";

  return (
    <div
      className={cx(
        "ui-progress-track w-full overflow-hidden rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] shadow-[inset_0_1px_1px_rgba(15,23,42,0.06)]",
        trackHeight,
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue * 100)}
    >
      <div
        className="ui-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--theme-accent-strong),var(--theme-accent))]"
        style={{
          width: "100%",
          transform: `scaleX(${normalizedValue})`,
          transformOrigin: "left center"
        }}
      />
    </div>
  );
}
