"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth";

const errorMap: Record<string, string> = {
  empty: "Введите логин и пароль.",
  invalid: "Неверный логин или пароль.",
  database: "Не удалось подключиться к базе данных. Проверьте DATABASE_URL и запустите PostgreSQL.",
  rateLimited: "Слишком много попыток входа. Подождите несколько минут и попробуйте снова."
};

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

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
              placeholder="teacher@example.com"
              className="shbz-input"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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

          {error && errorMap[error] ? (
            <div className="shbz-notice-error px-4 py-3 text-sm font-medium" aria-live="polite">
              {errorMap[error]}
            </div>
          ) : null}

          <button type="submit" className="shbz-btn-primary mt-1.5 h-[54px] w-full text-base">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
