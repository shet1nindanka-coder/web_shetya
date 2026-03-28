type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-mint transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
