import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();
  const activeTopics = data.topics.filter((topic) => topic.studentsWithActivity > 0).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Обзор преподавателя</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">Вся платформа в одном месте, но без перегруза</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Здесь собрана общая картина по темам, ученикам и статусам. Для рабочих сценариев используйте отдельные
            вкладки: темы, ученики и персональный прогресс каждого ученика.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-slate-100">Общий обзор</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Быстрые переходы</Badge>
            <Badge className="border-white/15 bg-white/10 text-slate-100">Живая статистика</Badge>
          </div>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Сейчас на платформе</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">
            {data.stats.totalMarked} отмеченных статусов по всем темам
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {activeTopics} тем уже имеют активность учеников. Для детального просмотра откройте вкладку тем или
            перейдите в карточку конкретного ученика.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все общие темы платформы." />
        <StatCard label="Ученики" value={data.stats.totalStudents} hint="Все аккаунты учеников." />
        <StatCard label="Файлы" value={data.stats.totalFiles} hint="Файлы теории и заданий внутри тем." />
        <StatCard label="Номера" value={data.stats.totalNumbers} hint="Все номера по всем темам." />
      </div>

      <SectionCard
        title="Быстрые переходы"
        description="Разделите работу по вкладкам: темы для материалов, ученики для учёток и карточек прогресса."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Темы</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-slate-950">Материалы, номера и статусы</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Создавайте темы, прикрепляйте файлы, задавайте номера и удаляйте старые темы с подтверждением прямо на
              сайте.
            </p>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Активные темы</span>
                <span className="font-semibold text-slate-950">
                  {activeTopics} / {data.stats.totalTopics}
                </span>
              </div>
              <ProgressBar value={data.stats.totalTopics ? Math.round((activeTopics / data.stats.totalTopics) * 100) : 0} />
            </div>
            <div className="mt-5">
              <Link
                href="/teacher/topics"
                className="ui-pressable inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Перейти к темам
              </Link>
            </div>
          </article>

          <article className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ученики</p>
            <h2 className="font-display mt-3 text-2xl font-semibold text-slate-950">Аккаунты и персональный прогресс</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Добавляйте учеников, открывайте их персональные карточки и смотрите, как именно они двигаются по всем темам.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge className="border-slate-200 bg-white text-slate-700">Учеников {data.stats.totalStudents}</Badge>
              <Badge className="border-slate-200 bg-white text-slate-700">Статусов {data.stats.totalMarked}</Badge>
            </div>
            <div className="mt-5">
              <Link
                href="/teacher/students"
                className="ui-pressable inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Перейти к ученикам
              </Link>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  );
}
