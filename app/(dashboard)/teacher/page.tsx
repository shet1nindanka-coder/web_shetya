import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();

  return (
    <div className="space-y-5 sm:space-y-6">
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
            <div className="ui-page-header-panel rounded-[14px] p-3.5 sm:rounded-[16px] sm:p-4">
              <p className="ui-kicker">Сейчас в системе</p>
              <p className="mt-1.5 font-display text-[1.3rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem]">
                {data.stats.totalFiles} файлов
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--theme-text-muted)]">Материалы тем и ответы уже загружены.</p>
            </div>
          </div>
        }
      />


      <SectionCard title="Быстрые переходы" description="Основные рабочие разделы преподавателя.">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="ui-fade-slide ui-surface rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
            <div className="space-y-1.5">
              <p className="ui-kicker">Темы</p>
              <h2 className="font-display text-lg font-semibold text-[var(--theme-text-strong)] sm:text-xl">Материалы и ответы</h2>
              <p className="ui-hint text-sm leading-relaxed text-[var(--theme-text-muted)]">Редактирование тем, файлов и номеров.</p>
            </div>
            <div className="mt-3">
              <Link
                href="/teacher/topics"
                className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
            <div className="space-y-1.5">
              <p className="ui-kicker">Ученики</p>
              <h2 className="font-display text-lg font-semibold text-[var(--theme-text-strong)] sm:text-xl">Аккаунты и прогресс</h2>
              <p className="ui-hint text-sm leading-relaxed text-[var(--theme-text-muted)]">Создание доступов и просмотр личного прогресса.</p>
            </div>
            <div className="mt-3">
              <Link
                href="/teacher/students"
                className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
              >
                Перейти к ученикам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
            <div className="space-y-1.5">
              <p className="ui-kicker">Статистика</p>
              <h2 className="font-display text-lg font-semibold text-[var(--theme-text-strong)] sm:text-xl">Разбор и аналитика</h2>
              <p className="ui-hint text-sm leading-relaxed text-[var(--theme-text-muted)]">Как идут темы по ученикам.</p>
            </div>
            <div className="mt-3">
              <Link
                href="/teacher/statistics"
                className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
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
