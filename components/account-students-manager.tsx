"use client";

import { useMemo, useState, useTransition } from "react";
import { changeStudentOwnersAction } from "@/actions/account";
import { deleteStudentAction } from "@/actions/student";
import { AccountPasswordResetButton } from "@/components/account-password-reset-button";
import { DeleteButton } from "@/components/delete-button";
import { ShbzSelect } from "@/components/shbz-select";
import { matchesAccountSearch } from "@/lib/utils";

/*
 * Список учеников на вкладке «Аккаунты» разработчика (Б-1/Б-4 аудита 10.08.2026):
 * смена учителя-владельца и сброс пароля без ручного SQL на VPS.
 * Учителя правятся в нескольких строках сразу и сохраняются одной кнопкой под
 * плашкой — так видно, что именно меняется, и не бывает половины сохранённого.
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
  searchQuery?: string;
};

function StudentRow({
  student,
  teachers,
  teacherId,
  isDirty,
  isPending,
  onTeacherChange,
  isLast
}: {
  student: Student;
  teachers: Teacher[];
  teacherId: string;
  isDirty: boolean;
  isPending: boolean;
  onTeacherChange: (teacherId: string) => void;
  isLast: boolean;
}) {
  const hasOwner = Boolean(student.teacherId);

  return (
    <div
      className="shbz-account-row"
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
          onChange={onTeacherChange}
          options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.name} (${teacher.email})` }))}
          placeholder={teachers.length ? "Выберите учителя" : "Сначала создайте учителя"}
          ariaLabel={`Учитель ученика ${student.name}`}
          size="sm"
          disabled={teachers.length === 0 || isPending}
        />
        {isDirty ? (
          <p className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--shbz-accent-solid)" }}>
            Изменено — не забудьте сохранить.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
        <AccountPasswordResetButton userId={student.id} userName={student.name} target="student" />
        <DeleteButton
          label="Удалить"
          title="Удалить ученика?"
          description={
            <>
              Аккаунт <span className="font-semibold">«{student.name}»</span> будет удалён вместе со всеми его
              ДЗ, фото решений, историей проверок, статусами по номерам и дедлайнами. Это действие нельзя
              отменить.
            </>
          }
          action={deleteStudentAction}
          fields={{ studentId: student.id }}
        />
      </div>
    </div>
  );
}

export function AccountStudentsManager({ students, teachers, searchQuery = "" }: AccountStudentsManagerProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // Правки, которые ещё не сохранены: пустой выбор и возврат к прежнему учителю не в счёт.
  const changes = useMemo(
    () =>
      students
        .map((student) => ({ student, teacherId: drafts[student.id] ?? student.teacherId ?? "" }))
        .filter((entry) => entry.teacherId && entry.teacherId !== (entry.student.teacherId ?? ""))
        .map((entry) => ({ studentId: entry.student.id, teacherId: entry.teacherId })),
    [drafts, students]
  );

  // Поиск фильтрует только отображение: несохранённые правки в скрытых
  // строках не пропадают и по-прежнему уходят на сервер кнопкой «Сохранить».
  const visibleStudents = useMemo(
    () => students.filter((student) => matchesAccountSearch(searchQuery, student.name, student.email)),
    [searchQuery, students]
  );

  if (students.length === 0) {
    return (
      <div className="shbz-card px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Пока ни одного ученика не создано.
        </p>
      </div>
    );
  }

  const save = () => {
    if (changes.length === 0 || isPending) {
      return;
    }

    const formData = new FormData();
    formData.append("changes", JSON.stringify(changes));

    // Экшен завершается redirect-ом со статусом в query — страница перерисуется сама.
    startTransition(async () => {
      await changeStudentOwnersAction(formData);
    });
  };

  return (
    <>
      {visibleStudents.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Никого не нашли.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Проверьте запрос — поиск идёт по имени и логину ученика.
          </p>
        </div>
      ) : (
        <div className="shbz-card px-7 py-2">
          {visibleStudents.map((student, index) => (
            <StudentRow
              key={student.id}
              student={student}
              teachers={teachers}
              teacherId={drafts[student.id] ?? student.teacherId ?? ""}
              isDirty={changes.some((entry) => entry.studentId === student.id)}
              isPending={isPending}
              onTeacherChange={(teacherId) => setDrafts((current) => ({ ...current, [student.id]: teacherId }))}
              isLast={index === visibleStudents.length - 1}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <p
          className={
            changes.length > 0
              ? "mr-auto text-[13.5px] font-semibold"
              : "ui-hint mr-auto text-[13.5px] font-semibold"
          }
          style={{ color: "var(--shbz-text-muted)" }}
        >
          {changes.length > 0
            ? `Учитель изменён у ${changes.length} ${changes.length === 1 ? "ученика" : "учеников"} — изменения ещё не сохранены.`
            : "Выберите учителя в нужных строках и сохраните изменения."}
        </p>
        <button
          type="button"
          onClick={() => setDrafts({})}
          disabled={changes.length === 0 || isPending}
          className="shbz-btn-outline shbz-btn-outline--lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          Отменить
        </button>
        <button
          type="button"
          onClick={save}
          disabled={changes.length === 0 || isPending}
          className="shbz-btn-primary px-[26px] py-[13px] text-[15px] disabled:cursor-not-allowed"
        >
          {isPending ? "Сохраняем..." : "Сохранить изменения"}
        </button>
      </div>
    </>
  );
}
