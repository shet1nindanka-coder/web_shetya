import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
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
        <div className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Обзор ученика</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">Ваш прогресс, темы и полезная инфа по ЕГЭ</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Здесь собрана личная картина по темам. Для работы с заданиями переходите на вкладку тем, а на вкладке
            общей информации можно быстро посмотреть перевод первичных баллов и разбалловку номеров.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-slate-100">Личный прогресс</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Темы с заданиями</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Справка по ЕГЭ</Badge>
          </div>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Личный итог</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{data.stats.solvedPercent}% номеров уже решены</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Здесь учитываются только номера со статусом зеленый или желтый. Красные показывают, где еще нужна помощь.
          </p>
          <div className="mt-5">
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              ✓ Завершено тем: {completedTopics}
            </Badge>
          </div>
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
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все темы платформы доступны в вашем кабинете." />
        <StatCard label="Завершены" value={completedTopics} hint="Темы, где все номера уже зеленые или желтые." />
        <StatCard label="Желтые" value={data.stats.totalYellow} hint="Исправленные после самопроверки номера." />
        <StatCard label="Красные" value={data.stats.totalRed} hint="Номера, где нужна помощь преподавателя." />
      </div>

      <SectionCard
        title="Быстрые переходы"
        description="Переключайтесь между рабочими вкладками без лишних экранов."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Темы</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-slate-950">Открыть файлы и отметить номера</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Перейдите к темам, чтобы открыть теорию, задания и выбрать цвет для каждого номера.
            </p>
            <div className="mt-5">
              <Link
                href="/student/topics"
                className="ui-pressable inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Общая инфа</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-slate-950">Перевод баллов и разбалловка</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Откройте таблицу соответствия первичных и тестовых баллов и посмотрите, сколько дают отдельные номера ЕГЭ.
            </p>
            <div className="mt-5">
              <Link
                href="/student/info"
                className="ui-pressable inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
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
