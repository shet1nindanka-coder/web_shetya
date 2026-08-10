"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteTeacherAction } from "@/actions/account";
import { AccountPasswordResetButton } from "@/components/account-password-reset-button";
import { ShbzSelect } from "@/components/shbz-select";

/*
 * Список учителей на вкладке «Аккаунты» разработчика: смена пароля и удаление.
 * Ученики удаляемого учителя не могут остаться без владельца (teacherId
 * объявлен onDelete: SetNull, а ученик без учителя не виден никому) — поэтому
 * в окне удаления обязателен выбор нового владельца.
 */

export type ManagedTeacher = {
  id: string;
  name: string;
  email: string;
  studentCount: number;
  lessonCount: number;
  testCount: number;
};

type AccountTeachersManagerProps = {
  teachers: ManagedTeacher[];
};

function pluralize(count: number, one: string, few: string, many: string) {
  const mod100 = count % 100;
  const mod10 = count % 10;

  if (mod100 >= 11 && mod100 <= 14) {
    return many;
  }

  if (mod10 === 1) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }

  return many;
}

function TeacherDeleteDialog({
  teacher,
  otherTeachers,
  onClose
}: {
  teacher: ManagedTeacher;
  otherTeachers: ManagedTeacher[];
  onClose: () => void;
}) {
  const [transferToTeacherId, setTransferToTeacherId] = useState("");
  const [isPending, startTransition] = useTransition();

  const needsTransfer = teacher.studentCount > 0;
  const hasTransferTarget = otherTeachers.length > 0;
  const isBlocked = needsTransfer && !hasTransferTarget;
  const isSubmitDisabled = isPending || isBlocked || (needsTransfer && !transferToTeacherId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, onClose]);

  const submit = () => {
    if (isSubmitDisabled) {
      return;
    }

    const formData = new FormData();
    formData.append("teacherId", teacher.id);
    formData.append("transferToTeacherId", transferToTeacherId);

    // Экшен завершается redirect-ом с query-статусом — страница перерисуется сама.
    startTransition(async () => {
      await deleteTeacherAction(formData);
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={() => (isPending ? undefined : onClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Удалить учителя"
        className="shbz-card max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-kicker)" }}>
            Удаление аккаунта
          </p>
          <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
            Удалить учителя «{teacher.name}»?
          </h3>
          <p className="text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
            Аккаунт и все его сессии будут удалены безвозвратно. Загруженные им файлы и история проверок ДЗ
            сохранятся.
          </p>
        </div>

        {teacher.lessonCount > 0 || teacher.testCount > 0 ? (
          <div
            className="mt-4 rounded-[12px] px-4 py-3 text-[13px] leading-[1.6]"
            style={{ background: "var(--shbz-red-soft)", color: "var(--shbz-danger-solid)" }}
          >
            Вместе с учителем удалятся его{" "}
            {teacher.lessonCount > 0
              ? `${teacher.lessonCount} ${pluralize(teacher.lessonCount, "занятие", "занятия", "занятий")}`
              : null}
            {teacher.lessonCount > 0 && teacher.testCount > 0 ? " и " : null}
            {teacher.testCount > 0
              ? `${teacher.testCount} ${pluralize(teacher.testCount, "тест", "теста", "тестов")}`
              : null}
            . Это действие нельзя отменить.
          </div>
        ) : null}

        {needsTransfer ? (
          <div className="mt-5">
            <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
              Кому передать учеников ({teacher.studentCount})
            </span>
            {hasTransferTarget ? (
              <ShbzSelect
                value={transferToTeacherId}
                onChange={setTransferToTeacherId}
                options={otherTeachers.map((option) => ({
                  value: option.id,
                  label: `${option.name} (${option.email})`
                }))}
                placeholder="Выберите учителя"
                ariaLabel="Новый учитель для учеников"
                size="sm"
                disabled={isPending}
              />
            ) : (
              <p className="text-[13px] font-medium leading-[1.5]" style={{ color: "var(--shbz-danger-solid)" }}>
                Это единственный учитель, а у него есть ученики. Сначала создайте другого учителя — иначе ученики
                останутся без владельца и пропадут из всех списков.
              </p>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="shbz-btn-outline shbz-btn-outline--lg"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitDisabled}
            className="shbz-btn-danger-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Удаляем..." : "Удалить учителя"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TeacherRow({
  teacher,
  otherTeachers,
  isLast
}: {
  teacher: ManagedTeacher;
  otherTeachers: ManagedTeacher[];
  isLast: boolean;
}) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  return (
    <div
      className="flex flex-col gap-3 py-5 md:grid md:grid-cols-[1.6fr_1fr_auto] md:items-center md:gap-5"
      style={!isLast ? { borderBottom: "1px solid var(--shbz-row-border)" } : undefined}
    >
      <div className="min-w-0">
        <div className="truncate text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          {teacher.name}
        </div>
        <div className="truncate text-[13.5px]" style={{ color: "var(--shbz-text-muted)" }}>
          {teacher.email}
        </div>
      </div>

      <div className="text-[13.5px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
        {teacher.studentCount > 0
          ? `${teacher.studentCount} ${pluralize(teacher.studentCount, "ученик", "ученика", "учеников")}`
          : "Без учеников"}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
        <AccountPasswordResetButton userId={teacher.id} userName={teacher.name} target="teacher" />
        <button type="button" onClick={() => setIsDeleteOpen(true)} className="shbz-btn-danger">
          Удалить
        </button>
      </div>

      {isDeleteOpen ? (
        <TeacherDeleteDialog teacher={teacher} otherTeachers={otherTeachers} onClose={() => setIsDeleteOpen(false)} />
      ) : null}
    </div>
  );
}

export function AccountTeachersManager({ teachers }: AccountTeachersManagerProps) {
  if (teachers.length === 0) {
    return (
      <div className="shbz-card px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Пока ни одного учителя не создано.
        </p>
      </div>
    );
  }

  return (
    <div className="shbz-card px-7 py-2">
      {teachers.map((teacher, index) => (
        <TeacherRow
          key={teacher.id}
          teacher={teacher}
          otherTeachers={teachers.filter((option) => option.id !== teacher.id)}
          isLast={index === teachers.length - 1}
        />
      ))}
    </div>
  );
}
