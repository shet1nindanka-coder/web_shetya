import { loginAction } from "@/actions/auth";

const errorMap: Record<string, string> = {
  empty: "Введите логин и пароль.",
  invalid: "Неверный логин или пароль.",
  database: "Не удалось подключиться к базе данных. Проверьте DATABASE_URL и запустите PostgreSQL."
};

type LoginFormProps = {
  error?: string;
};

export function LoginForm({ error }: LoginFormProps) {
  return (
    <div className="ui-fade-slide ui-surface w-full max-w-md rounded-[32px] border p-8">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="app-logo-mark mb-4 flex h-12 w-12 items-center justify-center rounded-[18px] text-base font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
          T
        </span>
        <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--theme-text-strong)]">Вход</h1>
      </div>

      <form action={loginAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--theme-text-default)]">Логин</span>
          <input
            type="text"
            name="login"
            placeholder="teacher@example.com"
            className="ui-input w-full rounded-2xl px-4 py-3"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--theme-text-default)]">Пароль</span>
          <input
            type="password"
            name="password"
            placeholder="Введите пароль"
            className="ui-input w-full rounded-2xl px-4 py-3"
            required
          />
        </label>

        {error && errorMap[error] ? (
          <div className="ui-notice-error rounded-2xl px-4 py-3 text-sm">
            {errorMap[error]}
          </div>
        ) : null}

        <button
          type="submit"
          className="ui-pressable ui-button-primary w-full rounded-2xl px-4 py-3 text-sm font-semibold transition"
        >
          Войти
        </button>
      </form>
    </div>
  );
}
