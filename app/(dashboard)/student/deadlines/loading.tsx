export default function StudentDeadlinesLoading() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="ui-page-header ui-surface rounded-[14px] border p-3.5 sm:rounded-[18px] sm:p-5 lg:rounded-[20px]">
        <div className="space-y-2">
          <div className="ui-skeleton h-3 w-24 rounded-full" />
          <div className="ui-skeleton h-8 w-64 rounded-2xl" />
          <div className="ui-skeleton h-4 w-80 max-w-full rounded-full" />
        </div>
      </section>

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
    </div>
  );
}
