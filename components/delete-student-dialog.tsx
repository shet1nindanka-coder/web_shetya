"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteStudentAction } from "@/actions/student";
import { cx } from "@/lib/utils";

type DeleteStudentDialogProps = {
  studentId: string;
  studentName: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

function DeleteStudentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-pressable ui-button-danger rounded-[12px] px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed"
    >
      {pending ? "Удаляем..." : "Да, удалить"}
    </button>
  );
}

export function DeleteStudentDialog({
  studentId,
  studentName,
  triggerLabel = "Удалить",
  triggerClassName
}: DeleteStudentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cx(
          "ui-pressable ui-button-danger inline-flex items-center justify-center rounded-[10px] px-3.5 py-1.5 text-sm font-semibold transition",
          triggerClassName
        )}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="ui-pop-in w-full max-w-md rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--theme-danger-text)]">Подтверждение</p>
              <h3 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Удалить ученика?</h3>
              <p className="text-sm leading-6 text-[var(--theme-text-default)]">
                Аккаунт <span className="font-semibold text-[var(--theme-text-strong)]">«{studentName}»</span> будет удалён вместе
                со статусами по номерам и назначенными дедлайнами. Это действие нельзя отменить.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2.5 text-sm font-semibold transition"
              >
                Отмена
              </button>

              <form action={deleteStudentAction}>
                <input type="hidden" name="studentId" value={studentId} />
                <DeleteStudentSubmitButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
