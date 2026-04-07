export function StudentDeadlinesCalendarSkeleton() {
  return (
    <section className="ui-surface relative overflow-hidden rounded-[16px] border p-3 sm:p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.12),transparent)] [background-size:220%_100%] animate-[ui-shimmer_1.6s_linear_infinite]" />
      <div className="mb-3 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-soft)] border-t-[var(--theme-accent-strong)]" />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="h-8 w-20 animate-pulse rounded-[10px] bg-[var(--theme-surface-soft)]" />
        <div className="h-6 w-44 animate-pulse rounded-full bg-[var(--theme-surface-soft)]" />
        <div className="h-8 w-20 animate-pulse rounded-[10px] bg-[var(--theme-surface-soft)]" />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={`weekday-${index}`} className="h-6 animate-pulse rounded-md bg-[var(--theme-surface-soft)]" />
        ))}
        {Array.from({ length: 42 }).map((_, index) => (
          <div key={`day-${index}`} className="h-12 animate-pulse rounded-[10px] bg-[var(--theme-surface-soft)]" />
        ))}
      </div>
    </section>
  );
}
