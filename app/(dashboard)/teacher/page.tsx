import Link from "next/link";
import { UserRole } from "@prisma/client";
import { SectionCard } from "@/components/section-card";
import { requireUser } from "@/lib/auth";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Кабинет преподавателя</h1>
          <p className="ui-hint mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Темы, ученики и статистика.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">Навигация</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">Темы, ученики и статистика</p>
        </div>
      </section>

      <SectionCard title="Быстрые переходы">
        <div className="grid gap-4 xl:grid-cols-3">
          <article className="ui-fade-slide ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
            <h2 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">Темы</h2>
            <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">Материалы, номера и ответы.</p>
            <div className="mt-5">
              <Link
                href="/teacher/topics"
                className="ui-pressable inline-flex w-full justify-center rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
            <h2 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">Ученики</h2>
            <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">Аккаунты и личный прогресс.</p>
            <div className="mt-5">
              <Link
                href="/teacher/students"
                className="ui-pressable inline-flex w-full justify-center rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
              >
                Перейти к ученикам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
            <h2 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">Статистика</h2>
            <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">Разбор и аналитика.</p>
            <div className="mt-5">
              <Link
                href="/teacher/statistics"
                className="ui-pressable inline-flex w-full justify-center rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
              >
                Открыть статистику
              </Link>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
