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
      />

      <SectionCard title="Быстрые переходы" description="Основные рабочие разделы преподавателя.">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="ui-action-card ui-fade-slide">
            <div className="ui-action-card-header">
              <p className="ui-kicker">Темы</p>
              <h2 className="ui-action-card-title font-display">Материалы и ответы</h2>
              <p className="ui-hint ui-action-card-copy">Редактирование тем, файлов и номеров.</p>
            </div>
            <div className="ui-mini-stat-grid grid-cols-2">
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Темы</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalTopics}</span>
              </div>
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Номера</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalNumbers}</span>
              </div>
            </div>
            <div className="ui-action-card-footer">
              <Link
                href="/teacher/topics"
                className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-action-card ui-fade-slide">
            <div className="ui-action-card-header">
              <p className="ui-kicker">Ученики</p>
              <h2 className="ui-action-card-title font-display">Аккаунты и прогресс</h2>
              <p className="ui-hint ui-action-card-copy">Создание доступов и просмотр личного прогресса.</p>
            </div>
            <div className="ui-mini-stat-grid grid-cols-2">
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Ученики</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalStudents}</span>
              </div>
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Файлы</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalFiles}</span>
              </div>
            </div>
            <div className="ui-action-card-footer">
              <Link
                href="/teacher/students"
                className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
              >
                Перейти к ученикам
              </Link>
            </div>
          </article>

          <article className="ui-action-card ui-fade-slide">
            <div className="ui-action-card-header">
              <p className="ui-kicker">Статистика</p>
              <h2 className="ui-action-card-title font-display">Разбор и аналитика</h2>
              <p className="ui-hint ui-action-card-copy">Кого разбирать, какие темы проседают и где есть быстрые победы.</p>
            </div>
            <div className="ui-mini-stat-grid grid-cols-2">
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Темы</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalTopics}</span>
              </div>
              <div className="ui-mini-stat-card">
                <span className="ui-mini-stat-card-label">Ученики</span>
                <span className="ui-mini-stat-card-value">{data.stats.totalStudents}</span>
              </div>
            </div>
            <div className="ui-action-card-footer">
              <Link
                href="/teacher/statistics"
                className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
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
