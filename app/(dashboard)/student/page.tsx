import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        eyebrow="Обзор"
        title="Ваш кабинет"
        description="Темы, прогресс и баллы собраны в одном месте."
        metrics={[
          { label: "Решено", value: `${data.stats.totalSolved} / ${data.stats.totalNumbers}` },
          { label: "Завершено тем", value: completedTopics, tone: "success" },
          { label: "Ждут разбора", value: data.stats.totalRed, tone: "danger" }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">Личный итог</p>
            <p className="mt-2 font-display text-[2rem] font-semibold text-[var(--theme-text-strong)]">
              {data.stats.solvedPercent}%
            </p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
                <span>Прорешано</span>
                <span className="font-semibold text-[var(--theme-text-strong)]">
                  {data.stats.totalSolved} / {data.stats.totalNumbers}
                </span>
              </div>
              <ProgressBar value={data.stats.solvedPercent} />
            </div>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Завершены" value={completedTopics} />
        <StatCard label="Желтые" value={data.stats.totalYellow} />
        <StatCard label="Красные" value={data.stats.totalRed} />
      </div>

      <SectionCard title="Быстрые переходы" description="Частые разделы для ежедневной работы.">
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="space-y-2">
              <p className="ui-kicker">Темы</p>
              <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Продолжить работу</h2>
              <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">Файлы, номера и статусы по всем темам.</p>
            </div>
            <div className="mt-4">
              <Link
                href="/student/topics"
                className="ui-pressable ui-button-primary inline-flex rounded-[14px] px-4 py-2.5 text-sm font-semibold transition"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="space-y-2">
              <p className="ui-kicker">Справка</p>
              <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Баллы ЕГЭ</h2>
              <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">Таблица баллов и разбалловка номеров.</p>
            </div>
            <div className="mt-4">
              <Link
                href="/student/info"
                className="ui-pressable ui-button-secondary inline-flex rounded-[14px] px-4 py-2.5 text-sm font-semibold transition"
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
