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
  return (
    <div className="ui-pop-in ui-surface w-full max-w-[380px] rounded-[12px] border p-6 sm:max-w-md sm:rounded-[16px] sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
        <span className="app-logo-mark mb-3 flex h-11 w-11 items-center justify-center rounded-[8px] text-base font-semibold text-white sm:mb-4 sm:h-12 sm:w-12 sm:rounded-[8px]">
          T
        </span>
        <h1 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)] sm:text-3xl">Вход</h1>
      </div>

      <form action={loginAction} className="space-y-3.5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--theme-text-default)]">Логин</span>
          <input
            type="text"
            name="login"
            placeholder="teacher@example.com"
            className="ui-input w-full rounded-[12px] px-3.5 py-2.5 text-sm sm:rounded-[14px] sm:px-4 sm:py-3"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[var(--theme-text-default)]">Пароль</span>
          <input
            type="password"
            name="password"
            placeholder="Введите пароль"
            className="ui-input w-full rounded-[12px] px-3.5 py-2.5 text-sm sm:rounded-[14px] sm:px-4 sm:py-3"
            required
            autoComplete="current-password"
            spellCheck={false}
          />
        </label>

        {error && errorMap[error] ? (
          <div className="ui-notice-error rounded-[12px] px-3.5 py-2.5 text-sm" aria-live="polite">
            {errorMap[error]}
          </div>
        ) : null}

        <button
          type="submit"
          className="ui-pressable ui-button-primary w-full rounded-[12px] px-4 py-2.5 text-sm font-semibold transition sm:rounded-[14px] sm:py-3"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
