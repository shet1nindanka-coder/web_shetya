import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/badge";
import { tryGetCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/utils";

export const dynamic = "force-dynamic";

const quickFacts = [
  {
    label: "Формат",
    value: "Общие темы и персональный прогресс",
    hint: "Одна база материалов для всех учеников, но собственные статусы у каждого."
  },
  {
    label: "Материалы",
    value: "Теория, задания и ответы рядом",
    hint: "Файлы, номера и LaTeX-ответы собраны внутри одной темы."
  },
  {
    label: "Основа",
    value: "Роли, PostgreSQL и Prisma",
    hint: "Структурированные данные, авторизация и готовность к следующей версии."
  }
] as const;

const featureCards = [
  {
    eyebrow: "Ученик",
    title: "Открывает тему и двигается по номерам без хаоса",
    description:
      "Теория, файл заданий, цветные статусы и ответы преподавателя лежат в одном сценарии, без таблиц и мессенджерного шума.",
    tone: "dark"
  },
  {
    eyebrow: "Преподаватель",
    title: "Собирает тему один раз и видит весь прогресс по ученикам",
    description:
      "Темы общие для всех, а платформа отдельно хранит, кто что уже решил, где ошибся и где нужна помощь.",
    tone: "light"
  },
  {
    eyebrow: "Продукт",
    title: "Рабочая база для частной практики уже собрана",
    description:
      "Авторизация, роли, загрузка файлов, статусы номеров, ответы в LaTeX и подготовка к деплою уже встроены в систему.",
    tone: "brand"
  }
] as const;

const workflowSteps = [
  {
    step: "01",
    title: "Преподаватель собирает тему",
    description: "Добавляет описание, файлы, номера заданий и текстовые ответы с формулами."
  },
  {
    step: "02",
    title: "Ученик работает внутри темы",
    description: "Открывает материалы, ставит цвет каждому номеру и в любой момент меняет статус."
  },
  {
    step: "03",
    title: "Прогресс виден сразу",
    description: "Система сохраняет результат по каждому ученику и показывает понятную картину по теме."
  }
] as const;

const productHighlights = [
  "Кабинет преподавателя и ученика с отдельной навигацией",
  "Загрузка PDF, DOCX и изображений с просмотром прямо на сайте",
  "Индивидуальные статусы по каждому номеру для каждого ученика",
  "Ответы преподавателя в LaTeX со spoiler-просмотром",
  "PostgreSQL + Prisma + роли + готовая структура для роста"
] as const;

const previewStatuses = [
  { label: "Зеленые", value: "12", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { label: "Желтые", value: "4", className: "border-amber-200 bg-amber-50 text-amber-700" },
  { label: "Красные", value: "2", className: "border-rose-200 bg-rose-50 text-rose-700" }
] as const;

export default async function HomePage() {
  const user = await tryGetCurrentUser();

  if (user) {
    redirect(roleHome(user.role));
  }

  return (
    <main className="soft-grid relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_52%)]" />
      <div className="pointer-events-none absolute -right-24 top-20 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[-80px] top-[380px] h-80 w-80 rounded-full bg-accent-gold/15 blur-3xl" />

      <div className="content-shell mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/72 px-5 py-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white shadow-lg shadow-slate-950/15">
              T
            </span>
            <div>
              <p className="font-display text-xl font-semibold text-slate-950">TutorFlow</p>
              <p className="text-sm text-slate-500">Платформа для частной практики и контроля прогресса</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-slate-200 bg-white text-slate-700">Ученик</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Преподаватель</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">LaTeX-ответы</Badge>
            </div>
            <Link
              href="/login"
              className="ui-pressable inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Открыть кабинет
            </Link>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[40px] border border-white/70 bg-white/84 px-5 py-6 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 sm:py-8 lg:px-10 lg:py-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/80 to-transparent" />
          <div className="pointer-events-none absolute -right-16 top-6 h-60 w-60 rounded-full bg-brand-200/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-accent-mint/20 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-8">
              <Badge className="border-brand-200 bg-brand-50 text-brand-700">Учебная платформа для частной практики</Badge>

              <div className="space-y-5">
                <h1 className="font-display max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[5.25rem]">
                  Общие темы для всех. Индивидуальный прогресс для каждого.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                  Преподаватель собирает материалы, задания и ответы в одном месте, а ученик открывает тему и сразу
                  показывает реальную картину по каждому номеру без лишних таблиц и ручного учёта.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="ui-pressable inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Войти в систему
                </Link>
                <Link
                  href="#overview"
                  className="ui-pressable inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Посмотреть возможности
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {quickFacts.map((fact) => (
                  <article
                    key={fact.label}
                    className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200/80 bg-white/88 p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)]"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{fact.label}</p>
                    <p className="mt-3 text-lg font-semibold leading-7 text-slate-950">{fact.value}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{fact.hint}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -left-4 top-16 hidden h-24 w-24 rounded-full border border-brand-200/60 bg-white/70 blur-[1px] lg:block" />
              <div className="pointer-events-none absolute -right-2 -top-4 hidden h-20 w-20 rounded-full bg-accent-gold/30 blur-2xl lg:block" />

              <div className="ui-fade-slide ui-surface relative mx-auto w-full max-w-[520px] rounded-[36px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,248,255,0.96))] p-5 shadow-[0_28px_70px_rgba(15,23,42,0.12)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Сценарий платформы</p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">Как это выглядит внутри</h2>
                  </div>
                  <Badge className="border-brand-200 bg-brand-50 text-brand-700">2 роли</Badge>
                </div>

                <div className="mt-5 rounded-[30px] bg-slate-950 p-5 text-white shadow-[0_24px_50px_rgba(15,23,42,0.24)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-200">Тема недели</p>
                      <h3 className="font-display mt-2 text-3xl font-semibold">Логарифмы и их свойства</h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">
                        Теория, файл заданий, номера и ответы преподавателя собраны на одной странице.
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-white/10 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Номеров</p>
                      <p className="mt-2 text-3xl font-semibold text-white">18</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {previewStatuses.map((status) => (
                      <div key={status.label} className={`rounded-[22px] border px-4 py-3 ${status.className}`}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">{status.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{status.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <article className="ui-surface rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Ученик</p>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold text-slate-950">Илья</p>
                        <p className="mt-2 text-sm text-slate-500">По теме уже решено 14 из 18 номеров.</p>
                      </div>
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">78%</Badge>
                    </div>
                    <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="ui-progress-fill h-full w-[78%] rounded-full bg-gradient-to-r from-brand-500 via-brand-400 to-accent-mint" />
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">№ 12 зеленый</Badge>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-700">№ 15 желтый</Badge>
                      <Badge className="border-rose-200 bg-rose-50 text-rose-700">№ 17 красный</Badge>
                    </div>
                  </article>

                  <article className="ui-surface rounded-[28px] border border-brand-100 bg-[linear-gradient(180deg,#eff6ff,#ffffff)] p-5 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-500">Ответ преподавателя</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">LaTeX и spoiler-просмотр</p>
                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-inner">
                      <p className="text-sm leading-6 text-slate-500">Нажмите, чтобы раскрыть ответ</p>
                      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 blur-[1.2px]">
                        <code>{"$$x = \\frac{-b \\pm \\sqrt{D}}{2a}$$"}</code>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">
                      Ученик видит ответ только по клику, а преподаватель может хранить его в нормальном текстовом формате.
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="overview" className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="grid gap-4">
            {featureCards.map((card) => (
              <article
                key={card.title}
                className={`ui-fade-slide ui-surface rounded-[34px] border p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] ${
                  card.tone === "dark"
                    ? "border-slate-950 bg-slate-950 text-white"
                    : card.tone === "brand"
                      ? "border-brand-200 bg-[linear-gradient(135deg,#246fe8,#1b53b0)] text-white"
                      : "border-white/80 bg-white/88 text-slate-950"
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.24em] ${
                    card.tone === "light" ? "text-slate-400" : "text-white/70"
                  }`}
                >
                  {card.eyebrow}
                </p>
                <h2 className="font-display mt-3 text-3xl font-semibold leading-tight">{card.title}</h2>
                <p
                  className={`mt-4 max-w-2xl text-base leading-7 ${
                    card.tone === "light" ? "text-slate-600" : "text-white/80"
                  }`}
                >
                  {card.description}
                </p>
              </article>
            ))}
          </div>

          <aside className="ui-fade-slide ui-surface rounded-[34px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <Badge className="border-brand-200 bg-brand-50 text-brand-700">Что уже внутри продукта</Badge>
            <h2 className="font-display mt-4 text-4xl font-semibold text-slate-950">Не просто лендинг, а уже рабочий сервис</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Платформа уже закрывает основной цикл занятий: от создания темы и файлов до контроля прогресса по каждому
              ученику и каждому номеру.
            </p>

            <div className="mt-6 space-y-3">
              {productHighlights.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-[24px] border border-slate-200 bg-slate-50/85 px-4 py-4"
                >
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section id="how" className="mt-8 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="ui-fade-slide ui-surface rounded-[34px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
            <Badge className="border-slate-200 bg-white text-slate-700">Как проходит работа</Badge>
            <div className="mt-5 space-y-4">
              {workflowSteps.map((item) => (
                <div key={item.step} className="rounded-[26px] border border-slate-200 bg-slate-50/85 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="ui-fade-slide ui-surface relative overflow-hidden rounded-[34px] border border-slate-950 bg-slate-950 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="pointer-events-none absolute right-0 top-0 h-44 w-44 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-full bg-accent-mint/15 blur-3xl" />

            <div className="relative">
              <Badge className="border-white/15 bg-white/10 text-brand-100">Готово к работе уже сейчас</Badge>
              <h2 className="font-display mt-4 text-4xl font-semibold">Откройте кабинет и работайте в одном контуре</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Преподаватель ведёт темы и прогресс, ученик видит понятную структуру занятий, а данные не теряются между
                файлами, таблицами и перепиской.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Вход</p>
                  <p className="mt-2 text-xl font-semibold text-white">Один кабинет для двух ролей</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">Контроль</p>
                  <p className="mt-2 text-xl font-semibold text-white">Каждый номер уже учитывается отдельно</p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="ui-pressable inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-brand-100"
                >
                  Перейти к входу
                </Link>
                <Link
                  href="#overview"
                  className="ui-pressable inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Сначала посмотреть блоки ниже
                </Link>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
