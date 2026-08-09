import { UserRole } from "@prisma/client";
import { AccountCreateForm } from "@/components/account-create-form";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/*
 * Вкладка разработчика «аккаунты»: создание учеников и учителей.
 * Живёт на /developer/accounts (rewrite с /teacher/accounts), доступна
 * только роли DEVELOPER — учитель добавляет учеников на своей вкладке.
 */

export const dynamic = "force-dynamic";

type AccountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const accountNotices = {
  studentCreated: {
    tone: "success",
    message: "Аккаунт ученика создан. Ему уже можно входить в систему."
  },
  teacherCreated: {
    tone: "success",
    message: "Аккаунт учителя создан. Ему уже можно входить в систему."
  },
  invalid: {
    tone: "error",
    message: "Укажите роль, учителя (для ученика), имя, логин и пароль: минимум 8 символов, обязательно буквы и цифры."
  },
  exists: {
    tone: "error",
    message: "Аккаунт с таким логином уже существует."
  },
  save: {
    tone: "error",
    message: "Не удалось создать аккаунт. Проверьте подключение к PostgreSQL и повторите попытку."
  },
  rateLimited: {
    tone: "error",
    message: "Слишком много попыток создать аккаунты за короткое время. Подождите несколько минут."
  }
} as const;

export default async function DeveloperAccountsPage({ searchParams }: AccountsPageProps) {
  await requireUser(UserRole.DEVELOPER);
  const params = (await searchParams) ?? {};
  // Мелкие форм-данные: список учителей для привязки ученика.
  const teachers = await prisma.user.findMany({
    where: { role: UserRole.TEACHER },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });
  const created = typeof params.accountCreated === "string" ? params.accountCreated : undefined;
  const error = typeof params.accountError === "string" ? params.accountError : undefined;

  const noticeKey =
    created === "teacher"
      ? "teacherCreated"
      : created === "student"
        ? "studentCreated"
        : error && error in accountNotices
          ? (error as Exclude<keyof typeof accountNotices, "studentCreated" | "teacherCreated">)
          : null;
  const notice = noticeKey ? accountNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader
        kicker="Аккаунты"
        title="Создание аккаунтов"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
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

      <section>
        <h2 className="shbz-section-title">Новый аккаунт</h2>
        <div className="shbz-card shbz-section-pad">
          <AccountCreateForm teachers={teachers} />
        </div>
      </section>
    </div>
  );
}
