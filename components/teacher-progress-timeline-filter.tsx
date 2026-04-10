"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type TeacherProgressTimelineFilterProps = {
  students: Array<{
    id: string;
    name: string;
  }>;
  selectedStudentId: string;
};

export function TeacherProgressTimelineFilter({
  students,
  selectedStudentId
}: TeacherProgressTimelineFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex w-full min-w-0 flex-col gap-1.5 sm:min-w-[220px] sm:max-w-[280px]">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--theme-text-muted)]">
        Ученик
      </span>
      <select
        value={selectedStudentId}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          const nextStudentId = event.target.value;

          if (nextStudentId) {
            params.set("studentId", nextStudentId);
          } else {
            params.delete("studentId");
          }

          const query = params.toString();

          startTransition(() => {
            router.replace(query ? `${pathname}?${query}` : pathname, {
              scroll: false
            });
          });
        }}
        className="ui-input w-full rounded-[14px] px-4 py-2.5 text-sm font-medium"
        aria-label="Фильтр статистики по ученику"
        disabled={isPending}
      >
        <option value="">Все ученики</option>
        {students.map((student) => (
          <option key={student.id} value={student.id}>
            {student.name}
          </option>
        ))}
      </select>
    </label>
  );
}
