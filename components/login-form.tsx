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
    <div className="ui-fade-slide relative w-full max-w-md overflow-hidden rounded-[38px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.93))] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur">
      <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-brand-100/50 blur-3xl" />
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-lg font-semibold text-white shadow-[0_16px_34px_rgba(29,78,216,0.22)]">
          T
        </span>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">TutorFlow</p>
        <h1 className="font-display mt-3 text-4xl font-semibold leading-tight text-slate-950">Вход в аккаунт</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">Откройте свой кабинет и продолжайте работу с темами, файлами и прогрессом.</p>
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
