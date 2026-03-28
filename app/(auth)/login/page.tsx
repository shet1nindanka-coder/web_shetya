import { redirect } from "next/navigation";
import { Badge } from "@/components/badge";
import { LoginForm } from "@/components/login-form";
import { tryGetCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await tryGetCurrentUser();

  if (user) {
    redirect(roleHome(user.role));
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;

  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="content-shell mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <section className="flex flex-col justify-between rounded-[36px] border border-white/60 bg-white/65 p-8 shadow-glow backdrop-blur">
          <div className="space-y-8">
            <Badge className="border-brand-200 bg-brand-50 text-brand-700">
              Учебная платформа для частной практики
            </Badge>
            <div className="space-y-5">
              <h1 className="font-display text-5xl font-semibold leading-[1.08] text-slate-950">
                Общие темы и индивидуальный прогресс без таблиц и хаоса
              </h1>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                Авторизуйтесь, чтобы открыть кабинет ученика или преподавателя. Интерфейс адаптирован под ноутбук,
                планшет и телефон.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[28px] bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-200">Ученик</p>
              <p className="mt-3 text-lg font-semibold">Темы и статусы</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">Открывает тему, смотрит файлы и отмечает номера цветом.</p>
            </div>
            <div className="rounded-[28px] bg-white p-5 text-slate-950 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Преподаватель</p>
              <p className="mt-3 text-lg font-semibold">CRUD тем и файлов</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Создаёт темы, загружает файлы и отслеживает матрицу прогресса.</p>
            </div>
            <div className="rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-100">Хранилище</p>
              <p className="mt-3 text-lg font-semibold">PostgreSQL + Prisma</p>
              <p className="mt-2 text-sm leading-6 text-brand-50">Структурированные данные, роли и сиды для быстрого старта.</p>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-center">
          <LoginForm error={error} />
        </div>
      </div>
    </main>
  );
}
