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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.8),transparent_50%)]" />
      <div className="pointer-events-none absolute -right-20 top-12 h-60 w-60 rounded-full bg-brand-300/15 blur-3xl" />

      <div className="content-shell mx-auto flex min-h-dvh w-full max-w-7xl flex-col px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="ui-surface mb-6 flex items-center justify-between gap-3 rounded-[14px] border px-3.5 py-2.5 backdrop-blur sm:mb-8 sm:rounded-[16px] sm:px-5 sm:py-3">
          <div className="flex items-center gap-2.5">
            <span className="app-logo-mark flex h-10 w-10 items-center justify-center rounded-[12px] text-sm font-semibold text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-[14px]">
              T
            </span>
            <div>
              <p className="font-display text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">TutorFlow</p>
              <p className="ui-copy-muted hidden text-xs sm:block">Платформа для частной практики</p>
            </div>
          </div>
          <Link
            href="/login"
            className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-sm font-semibold transition sm:rounded-[12px] sm:px-5 sm:py-2.5"
          >
            Войти
          </Link>
        </header>

        {/* Hero */}
        <section className="ui-surface relative overflow-hidden rounded-[18px] border px-4 py-6 backdrop-blur sm:rounded-[24px] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="pointer-events-none absolute -right-12 top-4 h-44 w-44 rounded-full bg-brand-200/14 blur-3xl" />

          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:items-center">
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-tight text-[var(--theme-text-strong)] sm:text-[2.8rem] lg:text-[3.8rem] lg:leading-[1]">
                  Темы, задания и&nbsp;результаты без&nbsp;лишнего хаоса
                </h1>
                <p className="ui-copy-muted max-w-xl text-[0.95rem] leading-relaxed sm:text-base sm:leading-7 lg:text-lg">
                  Платформа помогает преподавателю вести обучение по темам, а ученику понятно видеть свой прогресс по каждому номеру.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
                <Link
                  href="/login"
                  className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-[12px] px-5 py-3 text-sm font-semibold transition sm:rounded-[14px]"
                >
                  Открыть кабинет
                </Link>
                <a
                  href="#about"
                  className="ui-pressable ui-button-secondary inline-flex items-center justify-center rounded-[12px] px-5 py-3 text-sm font-semibold transition sm:rounded-[14px]"
                >
                  Коротко о платформе
                </a>
              </div>
            </div>

            <div className="ui-fade-slide rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-[var(--theme-hero)] p-5 text-white shadow-lg sm:rounded-[20px] sm:p-6">
              <h2 className="font-display text-xl font-semibold sm:text-2xl">Один понятный контур работы</h2>

              <div className="mt-4 space-y-2.5">
                {[
                  { title: "Общие темы для всех учеников", desc: "Материалы и задания собираются один раз и остаются в единой структуре." },
                  { title: "Индивидуальный прогресс по каждому номеру", desc: "У каждого ученика своя реальная картина по теме." },
                  { title: "Понятный интерфейс для ежедневной работы", desc: "Открыть тему, посмотреть материалы, отметить результат — за пару кликов." }
                ].map((item) => (
                  <div key={item.title} className="rounded-[12px] border border-white/10 bg-white/8 px-3.5 py-3 sm:px-4 sm:py-3.5">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-300 sm:text-sm sm:leading-6">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Value cards */}
        <section id="about" className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
          {valueCards.map((card) => (
            <article key={card.title} className="ui-fade-slide ui-surface rounded-[14px] border p-4 sm:rounded-[18px] sm:p-5">
              <h2 className="font-display text-xl font-semibold text-[var(--theme-text-strong)] sm:text-2xl">{card.title}</h2>
              <p className="ui-copy-muted mt-2 text-sm leading-relaxed sm:text-base sm:leading-7">{card.description}</p>
            </article>
          ))}
        </section>

        {/* CTA */}
        <section className="ui-surface mt-6 rounded-[16px] border px-4 py-6 text-center sm:mt-8 sm:rounded-[20px] sm:px-6 sm:py-8">
          <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)] sm:text-3xl">
            Войдите и откройте свой кабинет
          </h2>
          <p className="ui-copy-muted mx-auto mt-3 max-w-xl text-sm leading-relaxed sm:text-base sm:leading-7">
            Преподаватель ведёт темы и учеников, а ученик видит свои материалы и собственный прогресс.
          </p>
          <div className="mt-5">
            <Link
              href="/login"
              className="ui-pressable ui-button-primary inline-flex items-center justify-center rounded-[12px] px-5 py-3 text-sm font-semibold transition sm:rounded-[14px]"
            >
              Перейти ко входу
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
