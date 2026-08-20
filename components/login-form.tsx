"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/actions/auth";
import { MAX_PASSWORD_LENGTH } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH } from "@/lib/utils";

const errorMap: Record<string, string> = {
  empty: "Введите логин и пароль.",
  invalid: "Неверный логин или пароль.",
  database:
    "Не удалось войти — что-то сломалось на нашей стороне. Попробуйте через минуту, а если не пройдёт — напишите преподавателю.",
  rateLimited: "Слишком много попыток входа. Подождите несколько минут и попробуйте снова."
};

function formatMinutes(minutes: number) {
  const mod10 = minutes % 10;
  const mod100 = minutes % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${minutes} минуту`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${minutes} минуты`;
  }

  return `${minutes} минут`;
}

type LoginFormProps = {
  error?: string;
  /** Реальное окно блокировки в минутах — из редиректа ?error=rateLimited&min=N. */
  rateLimitedMinutes?: number;
  /** Контакт преподавателя из SiteSetting; пусто — строка помощи скрыта. */
  helpContact?: string;
};

// Пока server action входа выполняется, кнопка блокируется: двойное нажатие
// не сжигает попытку из лимита входа.
function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shbz-btn-primary mt-1.5 h-[54px] w-full text-base"
    >
      {pending ? "Входим…" : "Войти"}
    </button>
  );
}

export function LoginForm({ error, rateLimitedMinutes, helpContact }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const errorText =
    error === "rateLimited" && rateLimitedMinutes
      ? `Слишком много попыток входа. Попробуйте снова через ${formatMinutes(rateLimitedMinutes)}.`
      : error
        ? errorMap[error]
        : undefined;

  return (
    <div className="w-full max-w-[416px]">
      <div className="mb-[30px] text-center">
        <div
          className="inline-flex items-baseline gap-2 text-[30px] font-extrabold tracking-[-0.8px]"
          style={{ color: "var(--shbz-text-strong)" }}
        >
          <span>Вход</span>
          <span className="shbz-dot h-[9px] w-[9px] self-center" />
        </div>
        <div className="mt-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Войдите в личный кабинет платформы
        </div>
      </div>

      <div className="shbz-card p-[30px]">
        <form action={loginAction} className="flex flex-col gap-[18px]">
          <label className="flex flex-col gap-[9px]">
            <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
              Логин
            </span>
            <input
              type="text"
              name="login"
              inputMode="email"
              placeholder="teacher@example.com"
              className="shbz-input"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={MAX_LOGIN_LENGTH}
            />
          </label>

          <label className="flex flex-col gap-[9px]">
            <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
              Пароль
            </span>
            <div className="relative flex">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Введите пароль"
                className="shbz-input pr-[88px]"
                required
                autoComplete="current-password"
                spellCheck={false}
                maxLength={MAX_PASSWORD_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-2 top-1/2 h-[34px] -translate-y-1/2 rounded-[12px] px-3 text-[13px] font-semibold transition-colors"
                style={{ color: "var(--shbz-text-soft)" }}
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </label>

          {errorText ? (
            <div className="shbz-notice-error px-4 py-3 text-sm font-medium" aria-live="polite">
              {errorText}
            </div>
          ) : null}

          <LoginSubmitButton />
        </form>
      </div>

      {helpContact ? (
        <p className="mt-5 text-center text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Не получается войти? Напишите преподавателю: <span className="font-semibold">{helpContact}</span>
        </p>
      ) : null}
    </div>
  );
}
