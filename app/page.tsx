import Link from "next/link";
import { redirect } from "next/navigation";
import { tryGetCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

const valueCards = [
  {
    title: "Преподавателю",
    description: "Удобно собирать темы, добавлять материалы и быстро видеть прогресс каждого ученика."
  },
  {
    title: "Ученику",
    description: "Легко открывать нужную тему, смотреть материалы и отмечать результат по каждому номеру."
  },
  {
    title: "Прогресс",
    description: "По каждой теме сразу видно, что уже решено уверенно, что исправлено и где нужна помощь."
  }
] as const;

export default async function HomePage() {
  const user = await tryGetCurrentUser();

  if (user) {
    redirect(roleHome(user.role));
  }

  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.86),transparent_52%)]" />
      <div className="pointer-events-none absolute -right-24 top-16 h-72 w-72 rounded-full bg-brand-300/20 blur-3xl" />
      <div className="pointer-events-none absolute left-[-60px] top-[280px] h-72 w-72 rounded-full bg-accent-gold/12 blur-3xl" />

      <div className="content-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="ui-surface mb-8 flex flex-col gap-4 rounded-[28px] border px-5 py-4 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="app-logo-mark flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-lg shadow-slate-950/15">
              T
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-[var(--theme-text-strong)]">TutorFlow</p>
              <p className="ui-copy-muted text-sm">Платформа для частной практики</p>
            </div>
          </div>

          <Link
            href="/login"
            className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition"
          >
            Войти
          </Link>
        </header>

        <section className="ui-surface relative overflow-hidden rounded-[40px] border px-5 py-8 backdrop-blur sm:px-7 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute -right-16 top-6 h-56 w-56 rounded-full bg-brand-200/18 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-accent-mint/16 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="font-display max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--theme-text-strong)] sm:text-5xl lg:text-[4.8rem]">
                  Темы, задания и результаты без лишнего хаоса
                </h1>
                <p className="ui-copy-muted max-w-2xl text-lg leading-8 sm:text-xl">
                  Платформа помогает преподавателю вести обучение по темам, а ученику понятно видеть свой прогресс по
                  каждому номеру.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition"
                >
                  Открыть кабинет
                </Link>
                <a
                  href="#about"
                  className="ui-pressable ui-button-secondary inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition"
                >
                  Коротко о платформе
                </a>
              </div>
            </div>

            <div className="ui-fade-slide rounded-[34px] border border-[rgba(15,23,42,0.08)] bg-[var(--theme-hero)] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
              <h2 className="font-display text-3xl font-semibold">Один понятный контур работы</h2>

              <div className="mt-6 space-y-3">
                <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4">
                  <p className="text-sm font-semibold text-white">Общие темы для всех учеников</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Материалы и задания собираются один раз и остаются в единой структуре.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4">
                  <p className="text-sm font-semibold text-white">Индивидуальный прогресс по каждому номеру</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    У каждого ученика своя реальная картина по теме, а преподаватель видит её без ручного учёта.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-4">
                  <p className="text-sm font-semibold text-white">Понятный интерфейс для ежедневной работы</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Открыть тему, посмотреть материалы, отметить результат и продолжить занятие можно за пару кликов.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mt-8 grid gap-4 md:grid-cols-3">
          {valueCards.map((card) => (
            <article key={card.title} className="ui-fade-slide ui-surface rounded-[32px] border p-6">
              <h2 className="font-display text-3xl font-semibold leading-tight text-[var(--theme-text-strong)]">{card.title}</h2>
              <p className="ui-copy-muted mt-3 text-base leading-7">{card.description}</p>
            </article>
          ))}
        </section>

        <section className="ui-surface mt-8 rounded-[34px] border px-6 py-8 text-center">
          <h2 className="font-display text-4xl font-semibold text-[var(--theme-text-strong)]">Войдите и откройте свой кабинет</h2>
          <p className="ui-copy-muted mx-auto mt-4 max-w-2xl text-base leading-7">
            Преподаватель ведёт темы и учеников, а ученик видит свои материалы и собственный прогресс по заданиям.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition"
            >
              Перейти ко входу
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
