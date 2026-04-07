"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteTopicAction } from "@/actions/topic";
import { cx } from "@/lib/utils";

type DeleteTopicDialogProps = {
  topicId: string;
  topicTitle: string;
  triggerLabel?: string;
  triggerClassName?: string;
};

function DeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="ui-pressable ui-button-danger rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
    >
      {pending ? "Удаляем..." : "Да, удалить"}
    </button>
  );
}

export function DeleteTopicDialog({
  topicId,
  topicTitle,
  triggerLabel = "Удалить",
  triggerClassName
}: DeleteTopicDialogProps) {
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
          "ui-pressable ui-button-danger inline-flex rounded-[14px] px-5 py-3 text-sm font-semibold transition",
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
            className="ui-pop-in w-full max-w-md rounded-[32px] border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--theme-danger-text)]">Подтверждение</p>
              <h3 className="font-display text-3xl font-semibold text-[var(--theme-text-strong)]">Удалить тему?</h3>
              <p className="text-sm leading-6 text-[var(--theme-text-default)]">
                Тема <span className="font-semibold text-[var(--theme-text-strong)]">«{topicTitle}»</span> будет удалена вместе с
                прикреплёнными файлами и статусами по номерам. Это действие нельзя отменить.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ui-pressable ui-button-secondary rounded-2xl px-4 py-3 text-sm font-semibold transition"
              >
                Отмена
              </button>

              <form action={deleteTopicAction}>
                <input type="hidden" name="topicId" value={topicId} />
                <DeleteSubmitButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
