"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createAccountAction } from "@/actions/account";
import { AccountCredentialsDialog } from "@/components/account-credentials-dialog";
import { PasswordSuggestMenu } from "@/components/password-suggest-menu";
import { ShbzSelect } from "@/components/shbz-select";
import { generatePasswordFromName } from "@/lib/password-generate";
import { MAX_PASSWORD_LENGTH, validatePasswordStrength } from "@/lib/password-policy";
import { MAX_LOGIN_LENGTH, MAX_USER_NAME_LENGTH } from "@/lib/utils";

/*
 * Форма создания аккаунта разработчиком: интерфейс повторяет форму
 * «Добавить ученика» (student-create-form), сверху — переключатель роли.
 * После создания открывается окно с логином и паролем — единственный момент,
 * когда пароль можно скопировать.
 */

type AccountRole = "STUDENT" | "TEACHER";

const roleOptions: Array<{ value: AccountRole; label: string }> = [
  { value: "STUDENT", label: "Ученик" },
  { value: "TEACHER", label: "Учитель" }
];

type CreatedCredentials = { title: string; name: string; login: string; password: string };

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
  const [suggestedPassword, setSuggestedPassword] = useState<string | null>(null);
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedCredentials | null>(null);
  const [isPending, startTransition] = useTransition();

  const passwordError = useMemo(
    () => (password.length > 0 ? validatePasswordStrength(password) : null),
    [password]
  );

  const isSubmitDisabled =
    isPending ||
    !name.trim() ||
    !login.trim() ||
    password.length === 0 ||
    passwordError !== null ||
    (role === "STUDENT" && !teacherId);

  const roleLabel = role === "TEACHER" ? "учителя" : "ученика";

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }

    const formData = new FormData();
    formData.set("role", role);
    formData.set("teacherId", role === "STUDENT" ? teacherId : "");
    formData.set("name", name);
    formData.set("login", login);
    formData.set("password", password);

    setFormError(null);

    startTransition(async () => {
      const result = await createAccountAction(formData);

      if (!result.ok) {
        setFormError(result.message);
        return;
      }

      setCreated({
        title: result.message,
        name: name.trim(),
        login: login.trim().toLowerCase(),
        password
      });
      setName("");
      setLogin("");
      setPassword("");
      setSuggestedPassword(null);
      setIsSuggestOpen(false);
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
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
          <div className="min-w-[220px] flex-1">
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

        <label className="min-w-[220px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Имя {roleLabel}
          </span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              // Фамилия изменилась — прошлая подсказка устарела, соберём заново при фокусе.
              setSuggestedPassword(null);
              setIsSuggestOpen(false);
            }}
            placeholder="Мария Смирнова"
            className="shbz-input"
            required
            autoComplete="name"
            maxLength={MAX_USER_NAME_LENGTH}
          />
        </label>

        <label className="min-w-[220px] flex-1">
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

        <label className="min-w-[220px] flex-1">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Пароль
          </span>
          <input
            ref={passwordRef}
            // Пароль видно сразу: его диктуют ученику вслух, прятать нечего.
            type="text"
            name="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setIsSuggestOpen(false);
            }}
            onFocus={() => {
              // Меню всплывает, когда имя и логин уже заполнены, а пароль пуст.
              if (password.length === 0 && name.trim() && login.trim()) {
                setSuggestedPassword((current) => current ?? generatePasswordFromName(name));
                setIsSuggestOpen(true);
              }
            }}
            placeholder="Минимум 8 символов"
            className="shbz-input"
            style={
              passwordError
                ? { borderColor: "var(--shbz-danger-outline)", boxShadow: "none" }
                : undefined
            }
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={passwordError !== null}
            aria-describedby={passwordError ? "account-password-feedback" : undefined}
            maxLength={MAX_PASSWORD_LENGTH}
          />
          {suggestedPassword && isSuggestOpen ? (
            <PasswordSuggestMenu
              anchorRef={passwordRef}
              suggestion={suggestedPassword}
              onPick={(value) => {
                setPassword(value);
                setIsSuggestOpen(false);
                setFormError(null);
              }}
              onAnother={() => setSuggestedPassword(generatePasswordFromName(name))}
              onClose={() => setIsSuggestOpen(false)}
            />
          ) : null}
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
          <button type="submit" disabled={isSubmitDisabled} className="shbz-btn-primary shbz-btn-field px-[26px]">
            {isPending ? "Создаём..." : role === "TEACHER" ? "Создать учителя" : "Создать ученика"}
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
          title={created.title}
          name={created.name}
          login={created.login}
          password={created.password}
          onClose={() => setCreated(null)}
        />
      ) : null}
    </form>
  );
}
