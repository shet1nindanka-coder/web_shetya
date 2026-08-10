"use client";

import { useState, useTransition } from "react";
import { changeStudentOwnerAction } from "@/actions/account";
import { ShbzSelect } from "@/components/shbz-select";
import { StudentPasswordResetButton } from "@/components/student-password-reset-button";

/*
 * Список учеников на вкладке «Аккаунты» разработчика (Б-1/Б-4 аудита 10.08.2026):
 * смена учителя-владельца и сброс пароля без ручного SQL на VPS.
 */

type Teacher = {
  id: string;
  name: string;
  email: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
  teacherId: string | null;
};

type AccountStudentsManagerProps = {
  students: Student[];
  teachers: Teacher[];
};

function StudentRow({ student, teachers, isLast }: { student: Student; teachers: Teacher[]; isLast: boolean }) {
  const [teacherId, setTeacherId] = useState(student.teacherId ?? "");
  const [isPending, startTransition] = useTransition();

  const isDirty = teacherId !== "" && teacherId !== (student.teacherId ?? "");
  const hasOwner = Boolean(student.teacherId);

  const save = () => {
    if (!isDirty || isPending) {
      return;
    }

    const formData = new FormData();
    formData.append("studentId", student.id);
    formData.append("teacherId", teacherId);

    // Экшен завершается redirect-ом на /developer/accounts со статусом в query.
    startTransition(async () => {
      await changeStudentOwnerAction(formData);
    });
  };

  return (
    <div
      className="flex flex-col gap-3 py-5 md:grid md:grid-cols-[1.4fr_1.4fr_auto] md:items-center md:gap-5"
      style={!isLast ? { borderBottom: "1px solid var(--shbz-row-border)" } : undefined}
    >
      <div className="min-w-0">
        <div className="truncate text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          {student.name}
        </div>
        <div className="truncate text-[13.5px]" style={{ color: "var(--shbz-text-muted)" }}>
          {student.email}
        </div>
        {!hasOwner ? (
          <div className="mt-1 text-[12.5px] font-semibold" style={{ color: "var(--shbz-danger-solid)" }}>
            Без учителя — не виден ни одному учителю. Назначьте владельца.
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <ShbzSelect
          value={teacherId}
          onChange={setTeacherId}
          options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.name} (${teacher.email})` }))}
          placeholder={teachers.length ? "Выберите учителя" : "Сначала создайте учителя"}
          ariaLabel={`Учитель ученика ${student.name}`}
          size="sm"
          disabled={teachers.length === 0 || isPending}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isPending}
          className="shbz-btn-primary px-5 py-[11px] text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Сохраняем..." : "Сменить учителя"}
        </button>
        <StudentPasswordResetButton studentId={student.id} studentName={student.name} />
      </div>
    </div>
  );
}

export function AccountStudentsManager({ students, teachers }: AccountStudentsManagerProps) {
  if (students.length === 0) {
    return (
      <div className="shbz-card px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Пока ни одного ученика не создано.
        </p>
      </div>
    );
  }

  return (
    <div className="shbz-card px-7 py-2">
      {students.map((student, index) => (
        <StudentRow key={student.id} student={student} teachers={teachers} isLast={index === students.length - 1} />
      ))}
    </div>
  );
}
