"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { resetStudentPasswordAction } from "@/actions/student";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";

/*
 * Кнопка «Сменить пароль» у ученика (Б-1 аудита 10.08.2026): модалка с полем
 * нового пароля вместо единственного прежнего пути «удалить и создать заново».
 * Вёрстка модалки повторяет ConfirmDialog; та не подходит из-за поля ввода.
 */

type StudentPasswordResetButtonProps = {
  studentId: string;
  studentName: string;
  className?: string;
};

export function StudentPasswordResetButton({ studentId, studentName, className }: StudentPasswordResetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );
  const isSubmitDisabled = password.length === 0 || passwordError !== null || isPending;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
        setPassword("");
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPending]);

  const close = () => {
    if (!isPending) {
      setIsOpen(false);
      setPassword("");
    }
  };

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }

    const formData = new FormData();
    formData.append("studentId", studentId);
    formData.append("password", password);

    // Экшен завершается redirect-ом с query-статусом — страница перерисуется сама.
    startTransition(async () => {
      await resetStudentPasswordAction(formData);
    });
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={className ?? "shbz-btn-outline"}>
        Сменить пароль
      </button>

      {isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Сменить пароль ученика"
                className="shbz-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-kicker)" }}>
                    Смена пароля
                  </p>
                  <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
                    Новый пароль для «{studentName}»
                  </h3>
                  <p className="text-sm leading-6">
                    Все активные сессии ученика будут завершены — войти можно будет только с новым паролем.
                    Прогресс, ДЗ и история проверок не изменятся.
                  </p>
                </div>

                <form
                  className="mt-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSubmit();
                  }}
                >
                  <label className="block">
                    <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                      Новый пароль
                    </span>
                    <input
                      type="text"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="От 8 символов, буквы и цифры"
                      className="shbz-input"
                      style={
                        passwordError
                          ? { borderColor: "var(--shbz-danger-outline)", boxShadow: "none" }
                          : undefined
                      }
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      aria-invalid={passwordError !== null}
                      maxLength={MAX_PASSWORD_LENGTH}
                      disabled={isPending}
                    />
                    {passwordError ? (
                      <p
                        className="mt-2 text-[12.5px] font-medium leading-[1.4]"
                        style={{ color: "var(--shbz-danger-solid)" }}
                        aria-live="polite"
                      >
                        {passwordError}
                      </p>
                    ) : password.length > 0 ? (
                      <p className="mt-2 text-[12.5px] font-medium leading-[1.4]" style={{ color: "var(--shbz-green-text)" }}>
                        Пароль подходит. Запишите его — после сохранения он больше нигде не показывается.
                      </p>
                    ) : null}
                  </label>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={close} disabled={isPending} className="shbz-btn-outline disabled:opacity-60">
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitDisabled}
                      className="shbz-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Сохраняем..." : "Сменить пароль"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
