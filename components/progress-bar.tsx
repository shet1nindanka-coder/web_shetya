type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const normalizedValue = Math.min(100, Math.max(0, value)) / 100;

  return (
    <div className="h-3 overflow-hidden rounded-full border border-white/70 bg-slate-200/90 shadow-inner">
      <div
        className="ui-progress-fill h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-mint"
        style={{
          width: "100%",
          transform: `scaleX(${normalizedValue})`,
          transformOrigin: "left center"
        }}
      />
    </div>
  );
}
