import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/badge";
import { tryGetCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await tryGetCurrentUser();

  if (user) {
    redirect(roleHome(user.role));
  }

  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="content-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
              T
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-slate-950">TutorFlow MVP</p>
              <p className="text-sm text-slate-500">Платформа для репетитора и учеников</p>
            </div>
          </div>
          <Link
            href="/login"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Открыть кабинет
          </Link>
        </header>

        <section className="grid flex-1 gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <Badge className="border-brand-200 bg-brand-50 text-brand-700">
              MVP учебной платформы с ролями и PostgreSQL
            </Badge>

            <div className="space-y-6">
              <h1 className="font-display max-w-4xl text-5xl font-semibold leading-[1.05] text-slate-950 md:text-6xl">
                Общие темы, файлы и индивидуальный прогресс учеников в одном кабинете
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Ученик открывает тему, просматривает теорию и домашнее задание, а затем отмечает цветной статус
                каждому номеру. Преподаватель управляет темами, файлами и прогрессом по всем ученикам.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-glow">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Роли</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">Ученик и преподаватель</p>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-glow">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Теория</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">Файлы и встроенный просмотр</p>
              </div>
              <div className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-glow">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Домашка</p>
                <p className="mt-3 text-2xl font-semibold text-slate-950">Цветные статусы по номерам</p>
              </div>
            </div>
          </div>

          <div className="rounded-[36px] border border-white/70 bg-slate-950 p-8 text-white shadow-glow">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-200">Быстрый старт</p>
            <h2 className="font-display mt-4 text-3xl font-semibold">
              В проект уже заложены сиды, роли и PostgreSQL-схема
            </h2>
            <div className="mt-8 space-y-5 text-sm leading-7 text-slate-300">
              <p>В комплекте:</p>
              <p>Личный кабинет ученика со списком тем, файлами и цветными статусами по номерам.</p>
              <p>Кабинет преподавателя с CRUD тем, загрузкой файлов и матрицей прогресса по ученикам.</p>
              <p>Авторизация на cookie-сессиях и ролевой доступ к маршрутам.</p>
              <p>Подготовленные тестовые аккаунты и инструкции запуска в README.</p>
            </div>
            <Link
              href="/login"
              className="mt-8 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-brand-100"
            >
              Перейти к входу
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
