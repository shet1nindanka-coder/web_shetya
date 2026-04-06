import { UserRole } from "@prisma/client";
import { updatePasswordAction, updateProfileInfoAction } from "@/actions/profile";
import { InterfaceSettingsPanel } from "@/components/interface-settings-panel";
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
  const settingsOverview = [
    {
      label: "Интерфейс",
      value: "Тема, подсказки и плотность"
    },
    {
      label: "Профиль",
      value: "Имя и логин для входа"
    },
    {
      label: "Безопасность",
      value: "Смена пароля в один шаг"
    }
  ];

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "ui-notice-success rounded-[18px] px-5 py-4 text-sm font-medium"
              : "ui-notice-error rounded-[18px] px-5 py-4 text-sm font-medium"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="ui-surface rounded-[18px] border p-5 sm:rounded-[20px] sm:p-6">
          <p className="ui-kicker">Настройки</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--theme-text-strong)] sm:text-4xl">Настройки</h1>
          <p className="ui-hint ui-copy-muted mt-4 max-w-2xl text-sm leading-6 sm:text-base sm:leading-7">
            Здесь собраны настройки интерфейса, личная информация и смена пароля. Логин для входа остается
            фиксированным и не меняется из кабинета.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {settingsOverview.map((item) => (
              <div key={item.label} className="settings-summary-item rounded-[16px] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--theme-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-medium leading-6 text-[var(--theme-text-default)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-summary-card ui-surface rounded-[18px] border p-5 sm:rounded-[20px] sm:p-6">
          <p className="ui-kicker">Сейчас в профиле</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="ui-copy-muted text-sm">Имя</p>
              <p className="mt-2 text-xl font-semibold text-[var(--theme-text-strong)]">{user.name}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="ui-copy-muted text-sm">Логин</p>
              <p className="mt-2 break-all text-sm font-medium text-[var(--theme-text-default)]">{user.email}</p>
            </div>
            <div>
              <p className="ui-copy-muted text-sm">Роль</p>
              <p className="mt-2 text-sm font-semibold text-[var(--theme-text-strong)]">{roleLabel}</p>
            </div>
            <div>
              <p className="ui-copy-muted text-sm">На платформе с</p>
              <p className="mt-2 text-sm font-semibold text-[var(--theme-text-strong)]">{formatDate(user.createdAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <InterfaceSettingsPanel />

      <SectionCard
        title="Личная информация"
        description="Здесь можно изменить только имя профиля. Логин для входа остается неизменным."
      >
        <form action={updateProfileInfoAction} className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-default)]">Имя</span>
            <input
              type="text"
              name="name"
              defaultValue={user.name}
              placeholder="Ваше имя"
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-default)]">Логин для входа</span>
            <div className="ui-readonly-field rounded-[16px] px-4 py-3">{user.email}</div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable ui-button-primary rounded-[16px] px-5 py-3 text-sm font-semibold transition"
            >
              Сохранить личную информацию
            </button>
            <p className="ui-copy-muted text-sm leading-6">
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
            <span className="text-sm font-medium text-[var(--theme-text-default)]">Текущий пароль</span>
            <input
              type="password"
              name="currentPassword"
              placeholder="Введите текущий пароль"
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-default)]">Новый пароль</span>
            <input
              type="password"
              name="newPassword"
              placeholder="Минимум 8 символов"
              minLength={8}
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--theme-text-default)]">Повторите новый пароль</span>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Повторите новый пароль"
              minLength={8}
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
            />
          </label>

          <div className="xl:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable ui-button-primary rounded-[16px] px-5 py-3 text-sm font-semibold transition"
            >
              Обновить пароль
            </button>
            <p className="ui-copy-muted text-sm leading-6">Текущая сессия сохранится, входить заново не потребуется.</p>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
