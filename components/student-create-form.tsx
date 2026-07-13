"use client";

import { useMemo, useState } from "react";
import { createStudentAction } from "@/actions/student";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH, MAX_USER_NAME_LENGTH } from "@/lib/utils";

export function StudentCreateForm() {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );

  const isSubmitDisabled = !name.trim() || !login.trim() || password.length === 0 || passwordError !== null;

  return (
    <form action={createStudentAction}>
      <div className="flex flex-wrap items-start gap-4">
        <label className="min-w-[200px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Имя ученика
          </span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Мария Смирнова"
            className="shbz-input"
            required
            autoComplete="name"
            maxLength={MAX_USER_NAME_LENGTH}
          />
        </label>

        <label className="min-w-[200px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Логин ученика
          </span>
          <input
            type="text"
            name="login"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            placeholder="maria@example.com"
            className="shbz-input"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_LOGIN_LENGTH}
          />
        </label>

        <label className="min-w-[200px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Пароль
          </span>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Минимум 8 символов, буквы и цифры"
            className="shbz-input"
            style={
              passwordError
                ? { borderColor: "var(--shbz-danger-outline)", boxShadow: "none" }
                : undefined
            }
            required
            autoComplete="new-password"
            spellCheck={false}
            aria-invalid={passwordError !== null}
            aria-describedby={passwordError ? "student-password-feedback" : undefined}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {passwordError ? (
            <p
              id="student-password-feedback"
              className="mt-2 text-[12.5px] font-medium leading-[1.4]"
              style={{ color: "var(--shbz-danger-solid)" }}
              aria-live="polite"
            >
              {passwordError}
            </p>
          ) : password.length > 0 ? (
            <p className="mt-2 text-[12.5px] font-medium leading-[1.4]" style={{ color: "var(--shbz-green-text)" }}>
              Пароль подходит.
            </p>
          ) : null}
        </label>

        <button type="submit" disabled={isSubmitDisabled} className="shbz-btn-primary mt-[31px] h-[54px] shrink-0 px-[26px] text-[15px]">
          Добавить ученика
        </button>
      </div>
    </form>
  );
}
