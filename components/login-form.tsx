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
    <div className="ui-fade-slide w-full max-w-md rounded-[36px] border border-white/75 bg-white/92 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white shadow-lg shadow-slate-950/15">
          T
        </span>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">TutorFlow</p>
        <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-slate-950">Вход в аккаунт</h1>
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
    </div>
  );
}
