import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { formatDate } from "@/lib/utils";

type TeacherStudentPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentPage({ params }: TeacherStudentPageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;
  const data = await getTeacherStudentDetail(studentId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/teacher/students" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
            ← Ко всем ученикам
          </Link>
          <h1 className="font-display mt-3 text-4xl font-semibold text-slate-950">{data.student.name}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
            Логин: {data.student.email}. Здесь собран прогресс ученика по всем темам, включая цвета по каждому номеру.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge className="border-slate-200 bg-white text-slate-700">Тем {data.stats.totalTopics}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-700">
              Решено {data.stats.totalSolved}/{data.stats.totalNumbers}
            </Badge>
            <Badge className="border-slate-200 bg-white text-slate-700">
              Отмечено {data.stats.totalMarked}/{data.stats.totalNumbers}
            </Badge>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          Ученик в системе с{" "}
          <span className="font-semibold text-slate-950">{formatDate(data.student.createdAt)}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все общие темы, доступные ученику." />
        <StatCard label="Решено" value={`${data.stats.solvedPercent}%`} hint="Зеленые и желтые номера по всем темам." />
        <StatCard label="Желтые" value={data.stats.totalYellow} hint="Исправлены после самопроверки." />
        <StatCard label="Красные" value={data.stats.totalRed} hint="Номера, где ученику нужна помощь." />
      </div>

      <SectionCard
        title="Общая картина по ученику"
        description="Решено учитывает только зеленые и желтые номера, а отмечено показывает все номера с выбранным цветом."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Решено номеров</span>
              <span className="font-semibold text-slate-950">
                {data.stats.totalSolved} / {data.stats.totalNumbers}
              </span>
            </div>
            <ProgressBar value={data.stats.solvedPercent} />
          </div>
          <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Отмечено статусов</span>
              <span className="font-semibold text-slate-950">
                {data.stats.totalMarked} / {data.stats.totalNumbers}
              </span>
            </div>
            <ProgressBar value={data.stats.markedPercent} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Темы ученика"
        description="По каждой теме видно, сколько заданий решено, а ниже показаны статусы всех номеров."
      >
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Темы пока не добавлены</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Как только преподаватель создаст темы, здесь появится прогресс ученика по каждой из них.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {data.topics.map((topic) => (
              <article key={topic.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Номеров: {topic.totalNumbers}
                      </p>
                      <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">{topic.title}</h2>
                    </div>
                    <p className="max-w-3xl text-sm leading-6 text-slate-600">{topic.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-white text-slate-700">
                        Решено {topic.solvedCount}/{topic.totalNumbers}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700">
                        Отмечено {topic.markedCount}/{topic.totalNumbers}
                      </Badge>
                      <Badge className="border-slate-200 bg-white text-slate-700">Красные {topic.redCount}</Badge>
                    </div>
                  </div>

                  <div className="w-full max-w-md space-y-4">
                    <div className="space-y-2 rounded-[24px] border border-white bg-white p-4">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Решено по теме</span>
                        <span className="font-semibold text-slate-950">{topic.solvedPercent}%</span>
                      </div>
                      <ProgressBar value={topic.solvedPercent} />
                    </div>
                    <Link
                      href={`/teacher/topics/${topic.id}`}
                      className="ui-pressable inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                    >
                      Открыть тему
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {topic.numbers.map((number) => (
                    <div key={number.id} className="rounded-[24px] border border-white bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-lg font-semibold text-slate-950">№ {number.number}</p>
                        <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
