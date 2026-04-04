type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const normalizedValue = Math.min(100, Math.max(0, value)) / 100;

  return (
    <div className="h-3 overflow-hidden rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-soft)] shadow-inner">
      <div
        className="ui-progress-fill h-full rounded-full bg-[linear-gradient(90deg,var(--theme-accent-strong),var(--theme-accent),#6ee7b7)]"
        style={{
          width: "100%",
          transform: `scaleX(${normalizedValue})`,
          transformOrigin: "left center"
        }}
      />
    </div>
  );
}
