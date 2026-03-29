import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Badge } from "@/components/badge";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentTopicsPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);
  const completedTopics = data.topics.filter(
    (topic) => topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount === topic.totalNumbers
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Все темы и личный прогресс по каждой из них</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Темы общие для всех учеников, но статусы по номерам сохраняются индивидуально. Откройте нужную тему и
            отметьте, как у вас идут задания.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">По всем темам</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">
            {data.stats.totalSolved} из {data.stats.totalNumbers} номеров уже решены
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Здесь отображаются все темы с файлами и вашим текущим статусом по каждому набору заданий.
          </p>
          <p className="mt-5 text-sm font-medium text-emerald-700">Завершено тем: {completedTopics}</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все темы платформы доступны в вашем кабинете." />
        <StatCard label="Завершены" value={completedTopics} hint="Темы, где все номера уже зеленые или желтые." />
        <StatCard label="Зеленые" value={data.stats.totalGreen} hint="Номера, решенные верно с первого раза." />
        <StatCard label="Желтые" value={data.stats.totalYellow} hint="Номера, исправленные после самопроверки." />
      </div>

      <SectionCard
        title="Список тем"
        description="Откройте тему, чтобы посмотреть файлы теории и заданий, а также выставить статусы каждому номеру."
      >
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Темы пока не добавлены</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Как только преподаватель создаст первую тему, она появится здесь вместе с файлами и номерами.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => {
              const isCompleted = topic.totalNumbers > 0 && topic.greenCount + topic.yellowCount === topic.totalNumbers;

              return (
              <article key={topic.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div>
                      <h2 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">{topic.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">{topic.totalNumbers} номеров</p>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{topic.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="border-slate-200 bg-white text-slate-700">{topic.greenCount + topic.yellowCount} решено</Badge>
                      {isCompleted ? (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">✓ Тема завершена</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                  <span>Зеленые: <span className="font-semibold text-emerald-700">{topic.greenCount}</span></span>
                  <span>Желтые: <span className="font-semibold text-amber-700">{topic.yellowCount}</span></span>
                  <span>Красные: <span className="font-semibold text-rose-700">{topic.redCount}</span></span>
                </div>

                <div className="mt-5">
                  <Link
                    href={`/student/topics/${topic.id}`}
                    className="ui-pressable inline-flex w-full justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
                  >
                    {isCompleted ? "Открыть завершенную тему" : "Открыть тему"}
                  </Link>
                </div>
              </article>
            );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
