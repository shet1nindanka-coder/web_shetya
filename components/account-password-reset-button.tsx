"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useDialogExit } from "@/lib/animation-hooks";
import { resetTeacherPasswordAction } from "@/actions/account";
import { resetStudentPasswordAction } from "@/actions/student";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";

/*
 * Кнопка «Сменить пароль» для аккаунта (Б-1 аудита 10.08.2026): модалка с полем
 * нового пароля вместо единственного прежнего пути «удалить и создать заново».
 * Одна вёрстка на учеников и учителей — различаются только экшен и тексты.
 * Вёрстка модалки повторяет ConfirmDialog; та не подходит из-за поля ввода.
 */

export type AccountPasswordResetTarget = "student" | "teacher";

type AccountPasswordResetButtonProps = {
  userId: string;
  userName: string;
  target: AccountPasswordResetTarget;
  className?: string;
};

const TARGET_COPY: Record<AccountPasswordResetTarget, { dialogLabel: string; consequences: string }> = {
  student: {
    dialogLabel: "Сменить пароль ученика",
    consequences:
      "Все активные сессии ученика будут завершены — войти можно будет только с новым паролем. Прогресс, ДЗ и история проверок не изменятся."
  },
  teacher: {
    dialogLabel: "Сменить пароль учителя",
    consequences:
      "Все активные сессии учителя будут завершены — войти можно будет только с новым паролем. Его ученики, темы и история проверок не изменятся."
  }
};

export function AccountPasswordResetButton({ userId, userName, target, className }: AccountPasswordResetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );
  const isSubmitDisabled = password.length === 0 || passwordError !== null || isPending;
  const copy = TARGET_COPY[target];

  // A09: размонтирование после анимации выхода; все пути закрытия — через close.
  const { closing, close: closeAnimated } = useDialogExit(
    useCallback(() => {
      setIsOpen(false);
      setPassword("");
    }, [])
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        closeAnimated();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPending, closeAnimated]);

  const close = () => {
    if (!isPending) {
      closeAnimated();
    }
  };

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }

    const formData = new FormData();
    formData.append(target === "teacher" ? "teacherId" : "studentId", userId);
    formData.append("password", password);

    // Экшен завершается redirect-ом с query-статусом — страница перерисуется сама.
    startTransition(async () => {
      if (target === "teacher") {
        await resetTeacherPasswordAction(formData);
        return;
      }

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
              data-closing={String(closing)}
              className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6"
              onClick={close}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={copy.dialogLabel}
                data-closing={String(closing)}
                className="shbz-modal-card shbz-card max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-kicker)" }}>
                    Смена пароля
                  </p>
                  <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
                    Новый пароль для «{userName}»
                  </h3>
                  <p className="text-sm leading-6">{copy.consequences}</p>
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
                    <button
                      type="button"
                      onClick={close}
                      disabled={isPending}
                      className="shbz-btn-outline shbz-btn-outline--lg"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitDisabled}
                      className="shbz-btn-primary shbz-btn-primary--lg"
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
