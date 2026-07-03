"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ShbzSelect } from "@/components/shbz-select";

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
    <div className="flex w-full min-w-0 flex-col gap-[7px] sm:min-w-[220px] sm:max-w-[280px]">
      <span className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
        Ученик
      </span>
      <ShbzSelect
        size="sm"
        ariaLabel="Фильтр статистики по ученику"
        value={selectedStudentId}
        disabled={isPending}
        onChange={(nextStudentId) => {
          const params = new URLSearchParams(searchParams.toString());

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
        options={[
          { value: "", label: "Все ученики" },
          ...students.map((student) => ({ value: student.id, label: student.name }))
        ]}
      />
    </div>
  );
}
