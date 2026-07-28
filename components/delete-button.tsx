"use client";

import { useCallback, useState, useTransition, type CSSProperties, type ReactNode } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { cx } from "@/lib/utils";

type DeleteButtonProps = {
  /** Заголовок модалки, например «Удалить тему?». */
  title: string;
  /** Что именно произойдёт. Всегда объясняем последствия. */
  description?: ReactNode;
  /** Текст кнопки-триггера. Для variant="icon" не показывается. */
  label?: string;
  /** Подпись для скринридера — обязательна для variant="icon". */
  ariaLabel?: string;
  variant?: "default" | "sm" | "icon";
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  confirmLabel?: string;
  pendingLabel?: string;
  /** Серверный экшен: вызывается с FormData, собранной из `fields`. */
  action?: (formData: FormData) => void | Promise<void>;
  fields?: Record<string, string>;
  /** Клиентский обработчик (fetch). Ошибку можно бросить — уйдёт в onError. */
  onConfirm?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
};

export function DeleteButton({
  title,
  description,
  label = "Удалить",
  ariaLabel,
  variant = "default",
  className,
  style,
  disabled = false,
  confirmLabel,
  pendingLabel,
  action,
  fields,
  onConfirm,
  onError
}: DeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isActionPending, startTransition] = useTransition();

  const isPending = isRunning || isActionPending;

  const handleConfirm = useCallback(() => {
    if (isPending) {
      return;
    }

    if (action) {
      const formData = new FormData();

      for (const [key, value] of Object.entries(fields ?? {})) {
        formData.append(key, value);
      }

      startTransition(async () => {
        try {
          await action(formData);
        } catch (error) {
          onError?.(error);
        } finally {
          setIsOpen(false);
        }
      });

      return;
    }

    if (!onConfirm) {
      setIsOpen(false);
      return;
    }

    setIsRunning(true);

    void (async () => {
      try {
        await onConfirm();
        setIsOpen(false);
      } catch (error) {
        onError?.(error);
        setIsOpen(false);
      } finally {
        setIsRunning(false);
      }
    })();
  }, [action, fields, isPending, onConfirm, onError]);

  return (
    <>
      <button
        type="button"
        disabled={disabled || isPending}
        aria-label={ariaLabel ?? (variant === "icon" ? label : undefined)}
        title={variant === "icon" ? ariaLabel ?? label : undefined}
        onClick={() => setIsOpen(true)}
        style={style}
        className={cx(
          variant === "icon" ? "shbz-btn-danger-icon" : "shbz-btn-danger",
          variant === "sm" && "shbz-btn-danger--sm",
          className
        )}
      >
        {variant === "icon" ? "×" : label}
      </button>

      <ConfirmDialog
        open={isOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (!isPending) {
            setIsOpen(false);
          }
        }}
      />
    </>
  );
}
