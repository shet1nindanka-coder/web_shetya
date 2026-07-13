import { UserRole } from "@prisma/client";
import { updatePasswordAction, updateProfileInfoAction } from "@/actions/profile";
import { InterfaceSettingsPanel } from "@/components/interface-settings-panel";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { MAX_PASSWORD_LENGTH } from "@/lib/password-policy";
import { formatDate, MAX_USER_NAME_LENGTH } from "@/lib/utils";

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
    message: "Новый пароль: минимум 8 символов, обязательно буквы и цифры, без слишком простых комбинаций."
  },
  passwordMismatch: {
    tone: "error",
    message: "Новый пароль и подтверждение не совпадают."
  },
  passwordCurrent: {
    tone: "error",
    message: "Текущий пароль указан неверно."
  },
  passwordRateLimited: {
    tone: "error",
    message: "Слишком много попыток сменить пароль. Подождите 15 минут и попробуйте снова."
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
                  : passwordError === "rateLimited"
                    ? "passwordRateLimited"
                    : passwordError === "save"
                      ? "passwordSave"
                      : null;

  return noticeKey ? accountNotices[noticeKey] : null;
}

export function AccountSettingsView({ user, notice }: AccountSettingsViewProps) {
  const isTeacher = user.role === UserRole.TEACHER;
  const isDeveloper = user.role === UserRole.DEVELOPER;
  const roleLabel = isDeveloper ? "Разработчик" : isTeacher ? "Преподаватель" : "Ученик";

  return (
    <div>
      <ShbzPageHeader
        kicker="Профиль и интерфейс"
        title="Настройки"
        aside={
          <ShbzNumberSearch
            endpoint={
              isTeacher || isDeveloper ? "/api/teacher/topics/find-number" : "/api/student/homeworks/find-number"
            }
          />
        }
      />

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "shbz-notice-success mb-8 px-5 py-4 text-sm font-medium"
              : "shbz-notice-error mb-8 px-5 py-4 text-sm font-medium"
          }
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <InterfaceSettingsPanel />

      <section className="mb-11">
        <h2 className="shbz-section-title">Личная информация</h2>
        <div className="shbz-card shbz-section-pad">
          <form action={updateProfileInfoAction}>
            <div className="mb-[22px] grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <label className="block">
                <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                  Имя
                </span>
                <input
                  type="text"
                  name="name"
                  defaultValue={user.name}
                  placeholder="Ваше имя"
                  className="shbz-input"
                  required
                  autoComplete="name"
                  maxLength={MAX_USER_NAME_LENGTH}
                />
              </label>

              <div>
                <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                  Логин для входа
                </span>
                <div
                  className="shbz-input flex items-center"
                  style={{ color: "var(--shbz-text-muted)", cursor: "not-allowed", userSelect: "all" }}
                >
                  {user.email}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="shbz-btn-primary px-[26px] py-[13px] text-[15px]">
                Сохранить
              </button>
              <p className="ui-hint text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Имя в шапке обновится сразу.
              </p>
            </div>
          </form>
        </div>
      </section>

      <section className="mb-11">
        <h2 className="shbz-section-title">Сменить пароль</h2>
        <div className="shbz-card shbz-section-pad">
          <form action={updatePasswordAction}>
            <div className="mb-[22px] grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <label className="block">
                <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                  Текущий пароль
                </span>
                <input
                  type="password"
                  name="currentPassword"
                  placeholder="Введите текущий пароль"
                  className="shbz-input"
                  required
                  autoComplete="current-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                  Новый пароль
                </span>
                <input
                  type="password"
                  name="newPassword"
                  placeholder="От 8 символов, буквы и цифры"
                  minLength={8}
                  className="shbz-input"
                  required
                  autoComplete="new-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  spellCheck={false}
                />
              </label>

              <label className="block">
                <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                  Повторите новый пароль
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Повторите новый пароль"
                  minLength={8}
                  className="shbz-input"
                  required
                  autoComplete="new-password"
                  maxLength={MAX_PASSWORD_LENGTH}
                  spellCheck={false}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="shbz-btn-primary px-[26px] py-[13px] text-[15px]">
                Обновить пароль
              </button>
              <p className="ui-hint text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Сессии на других устройствах завершатся, текущая будет безопасно обновлена.
              </p>
            </div>
          </form>
        </div>
      </section>

      <section>
        <h2 className="shbz-section-title">Статус профиля</h2>
        <div className="shbz-card shbz-section-pad">
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="rounded-[16px] border px-[22px] py-5" style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}>
              <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                Роль
              </div>
              <div className="mt-2 text-[19px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                {roleLabel}
              </div>
            </div>
            <div className="rounded-[16px] border px-[22px] py-5" style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}>
              <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                На платформе
              </div>
              <div className="mt-2 text-[19px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                {formatDate(user.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
