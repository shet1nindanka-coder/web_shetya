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
    <label className="flex w-full min-w-0 flex-col gap-[7px] sm:min-w-[220px] sm:max-w-[280px]">
      <span className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
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
        className="shbz-select shbz-select--sm"
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
