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
    <div className="ui-fade-slide w-full max-w-md rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-glow backdrop-blur">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">Вход в систему</p>
        <h1 className="font-display text-4xl font-semibold leading-tight text-slate-950">
          Личный кабинет для занятий и контроля прогресса
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          Войдите как ученик или преподаватель, чтобы работать с общими темами, файлами и индивидуальными статусами по
          каждому номеру.
        </p>
      </div>

      <form action={loginAction} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Логин</span>
          <input
            type="text"
            name="login"
            placeholder="teacher@example.com"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Пароль</span>
          <input
            type="password"
            name="password"
            placeholder="Введите пароль"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
            required
          />
        </label>

        {error && errorMap[error] ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMap[error]}
          </div>
        ) : null}

        <button
          type="submit"
          className="ui-pressable w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:translate-y-[-1px] hover:bg-brand-700"
        >
          Войти
        </button>
      </form>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/80 p-4 text-sm leading-6 text-slate-700">
        <p className="font-semibold text-slate-900">Тестовые аккаунты</p>
        <p>
          Преподаватель: <code className="rounded bg-white px-1.5 py-0.5">teacher@example.com</code> /{" "}
          <code className="rounded bg-white px-1.5 py-0.5">teacher123</code>
        </p>
        <p>
          Ученик: <code className="rounded bg-white px-1.5 py-0.5">ilya@example.com</code> /{" "}
          <code className="rounded bg-white px-1.5 py-0.5">student123</code>
        </p>
      </div>
    </div>
  );
}
