import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview, getStudentTopicsOverview } from "@/lib/platform-data";

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === UserRole.TEACHER) {
    const data = await getTeacherTopicsOverview();

    return (
      <div className="space-y-8">
        <section className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Рабочая область</Badge>
          <h1 className="font-display mt-4 text-4xl font-semibold">Платформа готова к управлению темами и файлами</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Темы общие для всех учеников, а прогресс по номерам хранится отдельно для каждого пользователя. В кабинете
            преподавателя доступны создание, редактирование, удаление и просмотр статусов.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Темы" value={data.stats.totalTopics} hint="Все общие темы платформы." />
          <StatCard label="Ученики" value={data.stats.totalStudents} hint="Активные ученики в системе." />
          <StatCard label="Файлы" value={data.stats.totalFiles} hint="Файлы теории и домашки в storage." />
          <StatCard label="Статусы" value={data.stats.totalMarked} hint="Суммарно отмеченных номеров." />
        </div>

        <SectionCard title="Быстрый переход" description="Откройте кабинет преподавателя, чтобы управлять темами и файлами.">
          <Link
            href="/teacher"
            className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Перейти в кабинет преподавателя
          </Link>
        </SectionCard>
      </div>
    );
  }

  const data = await getStudentTopicsOverview(user.id);

  return (
    <div className="space-y-8">
      <section className="page-header-panel rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
        <Badge className="border-brand-300/40 bg-white/10 text-brand-100">Личный кабинет</Badge>
        <h1 className="font-display mt-4 text-4xl font-semibold">Все темы доступны из одного личного кабинета</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
          Откройте нужную тему, просмотрите теорию и домашнее задание, а затем выставьте цветной статус каждому номеру.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Общие темы, доступные вам после входа." />
        <StatCard label="Зеленые" value={data.stats.totalGreen} hint="Номера, решенные верно с первого раза." />
        <StatCard label="Желтые" value={data.stats.totalYellow} hint="Исправлены после самопроверки." />
        <StatCard label="Красные" value={data.stats.totalRed} hint="Нужна помощь преподавателя." />
      </div>

      <SectionCard title="Быстрый переход" description="Перейдите к карточкам тем и выберите нужную.">
        <Link
          href="/student"
          className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Перейти к темам
        </Link>
      </SectionCard>
    </div>
  );
}
