"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth";

const errorMap: Record<string, string> = {
  empty: "Введите логин и пароль.",
  invalid: "Неверный логин или пароль.",
  database: "Не удалось подключиться к базе данных. Проверьте DATABASE_URL и запустите PostgreSQL.",
  rateLimited: "Слишком много попыток входа. Подождите несколько минут и попробуйте снова."
};

const inputClassName =
  "h-[54px] w-full rounded-[14px] border-[1.5px] border-[#E4E5E7] bg-white px-4 text-[15px] text-[#0A0A0A] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#ABAEB3] focus:border-[#0A0A0A] focus:shadow-[0_0_0_4px_rgba(54,224,164,0.15)]";

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-[416px]">
      <div className="mb-[30px] text-center">
        <div className="inline-flex items-baseline gap-2 text-[30px] font-extrabold tracking-[-0.8px] text-[#0A0A0A]">
          <span>Вход</span>
          <span
            className="h-[9px] w-[9px] self-center rounded-full"
            style={{ background: "linear-gradient(90deg, #5AC8EA 0%, #36E0A4 100%)" }}
          />
        </div>
        <div className="mt-2 text-sm text-[#6A6E75]">Войдите в личный кабинет платформы</div>
      </div>

      <div className="rounded-[20px] border border-[#ECECEE] bg-white p-[30px] shadow-[0_1px_2px_rgba(10,10,10,0.04),0_14px_38px_rgba(10,10,10,0.07)]">
        <form action={loginAction} className="flex flex-col gap-[18px]">
          <label className="flex flex-col gap-[9px]">
            <span className="text-[13px] font-semibold text-[#2C2E33]">Логин</span>
            <input
              type="text"
              name="login"
              placeholder="teacher@example.com"
              className={inputClassName}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>

          <label className="flex flex-col gap-[9px]">
            <span className="text-[13px] font-semibold text-[#2C2E33]">Пароль</span>
            <div className="relative flex">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Введите пароль"
                className={`${inputClassName} pr-[88px]`}
                required
                autoComplete="current-password"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-2 top-1/2 h-[34px] -translate-y-1/2 rounded-full px-3 text-[13px] font-semibold text-[#8B8F96] transition-colors hover:text-[#0A0A0A]"
              >
                {showPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
          </label>

          {error && errorMap[error] ? (
            <div
              className="rounded-[14px] border border-[#F3C7C9] bg-[#FCEDED] px-4 py-3 text-sm font-medium text-[#D64550]"
              aria-live="polite"
            >
              {errorMap[error]}
            </div>
          ) : null}

          <button
            type="submit"
            className="mt-1.5 h-[54px] w-full rounded-full text-base font-bold text-white shadow-[0_6px_18px_rgba(54,224,164,0.30)] transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(54,224,164,0.42)]"
            style={{ background: "linear-gradient(90deg, #5AC8EA 0%, #36E0A4 100%)" }}
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
