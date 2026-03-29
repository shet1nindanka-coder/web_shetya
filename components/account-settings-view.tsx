import { UserRole } from "@prisma/client";
import { updatePasswordAction, updateProfileInfoAction } from "@/actions/profile";
import { Badge } from "@/components/badge";
import { SectionCard } from "@/components/section-card";
import { formatDate } from "@/lib/utils";

type ResolvedSearchParams = Record<string, string | string[] | undefined>;

type AccountSettingsViewProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
    createdAt: Date;
  };
  notice: AccountNotice;
};

export type AccountNotice =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

const accountNotices = {
  infoUpdated: {
    tone: "success",
    message: "Личная информация успешно обновлена."
  },
  infoInvalid: {
    tone: "error",
    message: "Укажите имя для профиля."
  },
  infoSave: {
    tone: "error",
    message: "Не удалось сохранить личную информацию. Повторите попытку."
  },
  passwordUpdated: {
    tone: "success",
    message: "Пароль успешно обновлен."
  },
  passwordInvalid: {
    tone: "error",
    message: "Введите текущий пароль и новый пароль не короче 8 символов."
  },
  passwordMismatch: {
    tone: "error",
    message: "Новый пароль и подтверждение не совпадают."
  },
  passwordCurrent: {
    tone: "error",
    message: "Текущий пароль указан неверно."
  },
  passwordSave: {
    tone: "error",
    message: "Не удалось обновить пароль. Повторите попытку."
  }
} as const;

export function resolveAccountNotice(searchParams: ResolvedSearchParams) {
  const infoUpdated = typeof searchParams.infoUpdated === "string" ? searchParams.infoUpdated : undefined;
  const infoError = typeof searchParams.infoError === "string" ? searchParams.infoError : undefined;
  const passwordUpdated =
    typeof searchParams.passwordUpdated === "string" ? searchParams.passwordUpdated : undefined;
  const passwordError = typeof searchParams.passwordError === "string" ? searchParams.passwordError : undefined;

  const noticeKey =
    infoUpdated === "1"
      ? "infoUpdated"
      : infoError === "invalid"
        ? "infoInvalid"
        : infoError === "save"
          ? "infoSave"
          : passwordUpdated === "1"
            ? "passwordUpdated"
            : passwordError === "invalid"
              ? "passwordInvalid"
              : passwordError === "mismatch"
                ? "passwordMismatch"
                : passwordError === "current"
                  ? "passwordCurrent"
                  : passwordError === "save"
                    ? "passwordSave"
                    : null;

  return noticeKey ? accountNotices[noticeKey] : null;
}

export function AccountSettingsView({ user, notice }: AccountSettingsViewProps) {
  const isTeacher = user.role === UserRole.TEACHER;
  const roleLabel = isTeacher ? "Преподаватель" : "Ученик";

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900"
              : "rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Личный кабинет</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">
            Управляйте своими данными и безопасностью аккаунта
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Здесь можно обновить имя профиля и сменить пароль. Логин для входа остается фиксированным и не меняется
            из кабинета.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-slate-100">{roleLabel}</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Личная информация</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Смена пароля</Badge>
          </div>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Сейчас в профиле</p>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Имя</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{user.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Логин</p>
              <p className="mt-2 break-all text-sm font-medium text-slate-700">{user.email}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Роль</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{roleLabel}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">На платформе с</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{formatDate(user.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionCard
        title="Личная информация"
        description="Здесь можно изменить только имя профиля. Логин для входа остается неизменным."
      >
        <form action={updateProfileInfoAction} className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Имя</span>
            <input
              type="text"
              name="name"
              defaultValue={user.name}
              placeholder="Ваше имя"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Логин для входа</span>
            <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600">{user.email}</div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Сохранить личную информацию
            </button>
            <p className="text-sm leading-6 text-slate-500">
              После сохранения в шапке кабинета сразу появятся новые данные.
            </p>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Сменить пароль"
        description="Для безопасности сначала введите текущий пароль, затем задайте новый."
      >
        <form action={updatePasswordAction} className="grid gap-4 xl:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Текущий пароль</span>
            <input
              type="password"
              name="currentPassword"
              placeholder="Введите текущий пароль"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Новый пароль</span>
            <input
              type="password"
              name="newPassword"
              placeholder="Минимум 8 символов"
              minLength={8}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Повторите новый пароль</span>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Повторите новый пароль"
              minLength={8}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
              required
            />
          </label>

          <div className="xl:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Обновить пароль
            </button>
            <p className="text-sm leading-6 text-slate-500">Текущая сессия сохранится, входить заново не потребуется.</p>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
