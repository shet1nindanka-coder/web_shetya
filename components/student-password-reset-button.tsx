"use client";

import { AccountPasswordResetButton } from "@/components/account-password-reset-button";

/*
 * Кнопка «Сменить пароль» у ученика (Б-1 аудита 10.08.2026). Сама модалка живёт
 * в AccountPasswordResetButton — она общая с учителями; здесь остаётся привычное
 * имя и набор пропсов для страниц учителя.
 */

type StudentPasswordResetButtonProps = {
  studentId: string;
  studentName: string;
  className?: string;
};

export function StudentPasswordResetButton({ studentId, studentName, className }: StudentPasswordResetButtonProps) {
  return (
    <AccountPasswordResetButton userId={studentId} userName={studentName} target="student" className={className} />
  );
}
