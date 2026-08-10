"use client";

import { useMemo, useState, useTransition } from "react";
import { createStudentAction } from "@/actions/student";
import { AccountCredentialsDialog } from "@/components/account-credentials-dialog";
import { generatePasswordFromName } from "@/lib/password-generate";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH, MAX_USER_NAME_LENGTH } from "@/lib/utils";

/*
 * Добавление ученика учителем. После создания открывается окно с логином и
 * паролем — единственный момент, когда пароль можно скопировать и передать.
 */

type CreatedCredentials = { name: string; login: string; password: string };

export function StudentCreateForm() {
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [suggestedPassword, setSuggestedPassword] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );

  const isSubmitDisabled =
    isPending || !name.trim() || !login.trim() || password.length === 0 || passwordError !== null;

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("login", login);
    formData.set("password", password);

    setFormError(null);

    startTransition(async () => {
      const result = await createStudentAction(formData);

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      setCreated({ name: name.trim(), login: login.trim().toLowerCase(), password });
      setName("");
      setLogin("");
      setPassword("");
      setShowPassword(false);
      setSuggestedPassword(null);
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <div className="flex flex-wrap items-start gap-4">
        <label className="min-w-[200px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Имя ученика
          </span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              // Фамилия изменилась — прошлая подсказка устарела, соберём заново при фокусе.
              setSuggestedPassword(null);
            }}
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
            type={showPassword ? "text" : "password"}
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onFocus={() => {
              // Подсказка появляется, когда имя и логин уже заполнены, а пароль пуст.
              if (password.length === 0 && name.trim() && login.trim()) {
                setSuggestedPassword(generatePasswordFromName(name));
              }
            }}
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
            aria-describedby={passwordError ? "student-password-feedback" : undefined}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {suggestedPassword && password.length === 0 ? (
            // preventDefault на mousedown: иначе blur поля срабатывает раньше клика по подсказке.
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setPassword(suggestedPassword);
                setShowPassword(true);
                setSuggestedPassword(null);
                setFormError(null);
              }}
              className="mt-2 block w-fit rounded-[999px] px-3 py-1.5 text-[12.5px] font-semibold"
              style={{ background: "var(--shbz-soft-bg)", color: "var(--shbz-accent-solid)" }}
            >
              Использовать пароль {suggestedPassword}
            </button>
          ) : null}
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

        <div className="shrink-0">
          {/* Невидимая метка повторяет структуру колонок — кнопка встаёт вровень с полями. */}
          <span className="mb-[9px] block text-[13px] font-semibold opacity-0" aria-hidden="true">
            {"\u00A0"}
          </span>
          <button type="submit" disabled={isSubmitDisabled} className="shbz-btn-primary h-[52px] px-[26px] text-[15px]">
            {isPending ? "Создаём..." : "Добавить ученика"}
          </button>
        </div>
      </div>

      {formError ? (
        <p className="mt-4 text-[13px] font-medium" style={{ color: "var(--shbz-red-text)" }} aria-live="polite">
          {formError}
        </p>
      ) : null}

      {created ? (
        <AccountCredentialsDialog
          title="Аккаунт ученика создан"
          name={created.name}
          login={created.login}
          password={created.password}
          onClose={() => setCreated(null)}
        />
      ) : null}
    </form>
  );
}
