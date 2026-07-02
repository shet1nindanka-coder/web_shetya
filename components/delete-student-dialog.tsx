"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteStudentAction } from "@/actions/student";

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
      className="shbz-btn-danger-solid"
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
        className={triggerClassName ?? "shbz-btn-danger"}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="shbz-card w-full max-w-md p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-danger-solid)" }}>Подтверждение</p>
              <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>Удалить ученика?</h3>
              <p className="text-sm leading-6">
                Аккаунт <span className="font-semibold">«{studentName}»</span> будет удалён вместе
                со статусами по номерам и назначенными дедлайнами. Это действие нельзя отменить.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="shbz-btn-outline"
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
