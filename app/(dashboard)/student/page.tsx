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

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[36px] border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-200">Кабинет ученика</p>
          <h1 className="font-display mt-4 text-4xl font-semibold">Все темы и личный прогресс по каждой из них</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Темы общие для всех учеников, но статусы по номерам сохраняются индивидуально. Откройте нужную тему и
            отметьте, как у вас идут домашние номера.
          </p>
        </div>

        <div className="rounded-[36px] border border-brand-100 bg-white/90 p-6 shadow-glow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Личный итог</p>
          <p className="mt-4 text-3xl font-semibold text-slate-950">
            {data.stats.totalMarked} из {data.stats.totalNumbers} номеров уже отмечены
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Зеленый — решено сразу, желтый — найдено и исправлено самостоятельно, красный — нужна помощь.
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} hint="Все темы платформы доступны в вашем кабинете." />
        <StatCard label="Зеленые" value={data.stats.totalGreen} hint="Номера, решенные верно с первого раза." />
        <StatCard label="Желтые" value={data.stats.totalYellow} hint="Номера, исправленные после самопроверки." />
        <StatCard label="Красные" value={data.stats.totalRed} hint="Номера, по которым нужна помощь." />
      </div>

      <SectionCard
        title="Список тем"
        description="Откройте тему, чтобы посмотреть файлы теории и домашнего задания, а также выставить статусы каждому номеру."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.topics.map((topic) => (
            <article key={topic.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Номеров: {topic.totalNumbers}
                    </p>
                    <h2 className="font-display mt-2 text-2xl font-semibold text-slate-950">{topic.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{topic.description}</p>
                </div>
                <div className="rounded-[24px] border border-white bg-white px-4 py-3 text-sm text-slate-600">
                  Файлы:{" "}
                  <span className="font-semibold text-slate-950">
                    {(topic.theoryFile ? 1 : 0) + (topic.homeworkFile ? 1 : 0)} / 2
                  </span>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Зеленые</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-700">{topic.greenCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Желтые</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-700">{topic.yellowCount}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Красные</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-700">{topic.redCount}</p>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Отмеченный прогресс</span>
                  <span className="font-semibold text-slate-950">{topic.progressPercent}%</span>
                </div>
                <ProgressBar value={topic.progressPercent} />
              </div>

              <div className="mt-5">
                <Link
                  href={`/student/topics/${topic.id}`}
                  className="inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Открыть тему
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
