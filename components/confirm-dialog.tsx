"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  /** Блокирует «Да»: например, пока не отмечена галочка осознанного согласия. */
  confirmDisabled?: boolean;
  /** Широкая модалка — для списков последствий, которые не влезают в max-w-md. */
  wide?: boolean;
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
  confirmDisabled = false,
  wide = false,
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
      className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={() => {
        if (!isPending) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`shbz-modal-card shbz-card w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[85vh] overflow-y-auto p-6`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-danger-solid)" }}>
            Подтверждение
          </p>
          <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
            {title}
          </h3>
          {description ? <div className="text-sm leading-6">{description}</div> : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            autoFocus
            className="shbz-btn-outline disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || confirmDisabled}
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
