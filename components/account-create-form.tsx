"use client";

import { useMemo, useState } from "react";
import { createAccountAction } from "@/actions/account";
import { ShbzSelect } from "@/components/shbz-select";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH, MAX_USER_NAME_LENGTH } from "@/lib/utils";

/*
 * Форма создания аккаунта разработчиком: интерфейс повторяет форму
 * «Добавить ученика» (student-create-form), сверху — переключатель роли.
 */

type AccountRole = "STUDENT" | "TEACHER";

const roleOptions: Array<{ value: AccountRole; label: string }> = [
  { value: "STUDENT", label: "Ученик" },
  { value: "TEACHER", label: "Учитель" }
];

type AccountCreateFormProps = {
  /** Учителя для привязки ученика: у каждого учителя свои ученики (SEC-003). */
  teachers: Array<{ id: string; name: string; email: string }>;
};

export function AccountCreateForm({ teachers }: AccountCreateFormProps) {
  const [role, setRole] = useState<AccountRole>("STUDENT");
  const [teacherId, setTeacherId] = useState("");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );

  const isSubmitDisabled =
    !name.trim() ||
    !login.trim() ||
    password.length === 0 ||
    passwordError !== null ||
    (role === "STUDENT" && !teacherId);
  const roleLabel = role === "TEACHER" ? "учителя" : "ученика";

  return (
    <form action={createAccountAction}>
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="teacherId" value={role === "STUDENT" ? teacherId : ""} />

      <div className="shbz-seg mb-5 inline-flex" role="group" aria-label="Роль нового аккаунта">
        {roleOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            data-active={role === option.value}
            onClick={() => setRole(option.value)}
            className="shbz-seg-btn shbz-seg-btn--plain"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {role === "STUDENT" ? (
          <div className="min-w-[200px] flex-1">
            <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
              Учитель ученика
            </span>
            <ShbzSelect
              value={teacherId}
              onChange={setTeacherId}
              options={teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.name} (${teacher.email})` }))}
              placeholder={teachers.length ? "Выберите учителя" : "Сначала создайте учителя"}
              ariaLabel="Учитель ученика"
              disabled={teachers.length === 0}
            />
          </div>
        ) : null}

        <label className="min-w-[200px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Имя {roleLabel}
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
            Логин {roleLabel}
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
            placeholder="От 8 символов, буквы и цифры"
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
            aria-describedby={passwordError ? "account-password-feedback" : undefined}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {passwordError ? (
            <p
              id="account-password-feedback"
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

        <div className="shrink-0">
          {/* Невидимая метка повторяет структуру колонок — кнопка встаёт вровень с полями. */}
          <span className="mb-[9px] block text-[13px] font-semibold opacity-0" aria-hidden="true">
            {"\u00A0"}
          </span>
          <button type="submit" disabled={isSubmitDisabled} className="shbz-btn-primary h-[52px] px-[26px] text-[15px]">
            {role === "TEACHER" ? "Создать учителя" : "Создать ученика"}
          </button>
        </div>
      </div>
    </form>
  );
}
