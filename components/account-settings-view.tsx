import { UserRole } from "@prisma/client";
import { updatePasswordAction, updateProfileInfoAction } from "@/actions/profile";
import { InterfaceSettingsPanel } from "@/components/interface-settings-panel";
import { PageHeader } from "@/components/page-header";
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
              ? "ui-notice-success rounded-[18px] px-5 py-4 text-sm font-medium"
              : "ui-notice-error rounded-[18px] px-5 py-4 text-sm font-medium"
          }
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <PageHeader
        eyebrow="Настройки"
        title="Настройки"
      />

      <InterfaceSettingsPanel />

      <SectionCard
        title="Личная информация"
        description="Логин остаётся фиксированным, имя можно обновить."
      >
        <form action={updateProfileInfoAction} className="grid gap-4 lg:grid-cols-2">
          <label className="block space-y-2">
            <span className="ui-form-label">Имя</span>
            <input
              type="text"
              name="name"
              defaultValue={user.name}
              placeholder="Ваше имя"
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
              autoComplete="name"
            />
          </label>

          <div className="space-y-2">
            <span className="ui-form-label">Логин для входа</span>
            <div className="ui-readonly-field rounded-[16px] px-4 py-3">{user.email}</div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable ui-button-primary rounded-[16px] px-5 py-3 text-sm font-semibold transition"
            >
              Сохранить
            </button>
            <p className="ui-hint ui-copy-muted text-sm leading-6">Имя в шапке обновится сразу.</p>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Сменить пароль"
        description="Сначала введите текущий пароль, затем новый."
      >
        <form action={updatePasswordAction} className="grid gap-4 xl:grid-cols-3">
          <label className="block space-y-2">
            <span className="ui-form-label">Текущий пароль</span>
            <input
              type="password"
              name="currentPassword"
              placeholder="Введите текущий пароль"
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
              autoComplete="current-password"
              spellCheck={false}
            />
          </label>

          <label className="block space-y-2">
            <span className="ui-form-label">Новый пароль</span>
            <input
              type="password"
              name="newPassword"
              placeholder="Минимум 8 символов"
              minLength={8}
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>

          <label className="block space-y-2">
            <span className="ui-form-label">Повторите новый пароль</span>
            <input
              type="password"
              name="confirmPassword"
              placeholder="Повторите новый пароль"
              minLength={8}
              className="ui-input w-full rounded-[16px] px-4 py-3"
              required
              autoComplete="new-password"
              spellCheck={false}
            />
          </label>

          <div className="xl:col-span-3 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="ui-pressable ui-button-primary rounded-[16px] px-5 py-3 text-sm font-semibold transition"
            >
              Обновить пароль
            </button>
            <p className="ui-hint ui-copy-muted text-sm leading-6">Текущая сессия сохранится.</p>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Статус профиля"
        description="Короткая служебная информация по аккаунту."
      >
        <div className="ui-mini-stat-grid md:grid-cols-2">
          <article className="ui-mini-stat-card">
            <span className="ui-mini-stat-card-label">Роль</span>
            <span className="ui-mini-stat-card-value">{roleLabel}</span>
          </article>
          <article className="ui-mini-stat-card">
            <span className="ui-mini-stat-card-label">На платформе</span>
            <span className="ui-mini-stat-card-value">{formatDate(user.createdAt)}</span>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
