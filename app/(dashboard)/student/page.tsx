import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);
  const completedTopics = data.topics.filter(
    (topic) => topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount === topic.totalNumbers
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Ваш кабинет</h1>
          <p className="ui-hint mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Темы, прогресс и справка по баллам.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">Личный итог</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">{data.stats.solvedPercent}% номеров уже решены</p>
          <p className="mt-5 text-sm font-medium text-emerald-700">Завершено тем: {completedTopics}</p>
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Решено номеров</span>
              <span className="font-semibold text-slate-950">
                {data.stats.totalSolved} / {data.stats.totalNumbers}
              </span>
            </div>
            <ProgressBar value={data.stats.solvedPercent} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Завершены" value={completedTopics} />
        <StatCard label="Желтые" value={data.stats.totalYellow} />
        <StatCard label="Красные" value={data.stats.totalRed} />
      </div>

      <SectionCard title="Быстрые переходы">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <h2 className="font-display text-2xl font-semibold text-slate-950">Темы</h2>
            <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">Файлы, номера и статусы.</p>
            <div className="mt-5">
              <Link
                href="/student/topics"
                className="ui-pressable inline-flex rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <h2 className="font-display text-2xl font-semibold text-slate-950">Общая инфа</h2>
            <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">Баллы и разбалловка.</p>
            <div className="mt-5">
              <Link
                href="/student/info"
                className="ui-pressable inline-flex rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Открыть общую инфу
              </Link>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
