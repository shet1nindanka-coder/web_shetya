import { StudentDeadlinesCalendarSkeleton } from "@/components/student-deadlines-calendar-skeleton";

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

      <StudentDeadlinesCalendarSkeleton />
    </div>
  );
}
