"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Да, удалить",
  pendingLabel = "Удаляем...",
  cancelLabel = "Отмена",
  isPending = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        onCancel();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isPending, onCancel]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={() => {
        if (!isPending) {
          onCancel();
        }
      }}
    >
      <div className="shbz-card w-full max-w-md p-6" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-danger-solid)" }}>
            Подтверждение
          </p>
          <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
            {title}
          </h3>
          {description ? <p className="text-sm leading-6">{description}</p> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onCancel} disabled={isPending} className="shbz-btn-outline disabled:opacity-60">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="shbz-btn-danger-solid disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
