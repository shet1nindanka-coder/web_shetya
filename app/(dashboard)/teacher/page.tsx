import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Обзор"
        title="Кабинет преподавателя"
        description="Темы, ученики и статистика собраны в единую рабочую панель."
        metrics={[
          { label: "Темы", value: data.stats.totalTopics },
          { label: "Ученики", value: data.stats.totalStudents },
          { label: "Номера", value: data.stats.totalNumbers }
        ]}
        aside={
          <div className="ui-page-header-aside">
            <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
              <p className="ui-kicker">Сейчас в системе</p>
              <p className="mt-2 font-display text-[1.7rem] font-semibold text-[var(--theme-text-strong)]">
                {data.stats.totalFiles} файлов
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">Материалы тем и ответы уже загружены в систему.</p>
            </div>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Ученики" value={data.stats.totalStudents} />
        <StatCard label="Файлы" value={data.stats.totalFiles} />
        <StatCard label="Номера" value={data.stats.totalNumbers} />
      </div>

      <SectionCard title="Быстрые переходы" description="Основные рабочие разделы преподавателя.">
        <div className="grid gap-4 xl:grid-cols-3">
          <article className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="space-y-2">
              <p className="ui-kicker">Темы</p>
              <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Материалы и ответы</h2>
              <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">Редактирование тем, файлов и номеров.</p>
            </div>
            <div className="mt-4">
              <Link
                href="/teacher/topics"
                className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="space-y-2">
              <p className="ui-kicker">Ученики</p>
              <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Аккаунты и прогресс</h2>
              <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">Создание доступов и просмотр личного прогресса.</p>
            </div>
            <div className="mt-4">
              <Link
                href="/teacher/students"
                className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto"
              >
                Перейти к ученикам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[20px] border p-4 sm:p-5">
            <div className="space-y-2">
              <p className="ui-kicker">Статистика</p>
              <h2 className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Разбор и аналитика</h2>
              <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">Кому нужен разбор и как идут темы по ученикам.</p>
            </div>
            <div className="mt-4">
              <Link
                href="/teacher/statistics"
                className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto"
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
