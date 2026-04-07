export function StudentDeadlinesCalendarSkeleton() {
  return (
    <section className="ui-surface rounded-[16px] border p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="ui-skeleton h-8 w-20 rounded-[10px]" />
        <div className="ui-skeleton h-6 w-44 rounded-full" />
        <div className="ui-skeleton h-8 w-20 rounded-[10px]" />
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={`weekday-${index}`} className="ui-skeleton h-6 rounded-md" />
        ))}
        {Array.from({ length: 42 }).map((_, index) => (
          <div key={`day-${index}`} className="ui-skeleton h-12 rounded-[10px]" />
        ))}
      </div>
    </section>
  );
}
