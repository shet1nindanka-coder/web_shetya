import Link from "next/link";
import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { setStudentNumberStatusAction } from "@/actions/topic";
import { FileResourceCard } from "@/components/file-resource-card";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { requireUser } from "@/lib/auth";
import { getStudentTopicDetail } from "@/lib/platform-data";
import { cx, homeworkStatusMeta } from "@/lib/utils";

type StudentTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
};

export default async function StudentTopicPage({ params }: StudentTopicPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { topicId } = await params;
  const topic = await getStudentTopicDetail(user.id, topicId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/student" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
            ← Ко всем темам
          </Link>
          <h1 className="font-display mt-3 text-4xl font-semibold text-slate-950">{topic.title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{topic.description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Номера" value={topic.totalNumbers} hint="Всего номеров в домашнем задании этой темы." />
        <StatCard label="Зеленые" value={topic.greenCount} hint="Решены сразу и правильно." />
        <StatCard label="Желтые" value={topic.yellowCount} hint="Исправлены после самопроверки." />
        <StatCard label="Красные" value={topic.redCount} hint="Нужна помощь преподавателя." />
      </div>

      <SectionCard
        title="Общий прогресс по теме"
        description="Чем больше номеров вы отметили, тем точнее преподаватель видит ваш текущий уровень по теме."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Отмечено номеров</span>
            <span className="font-semibold text-slate-950">
              {topic.markedCount} / {topic.totalNumbers}
            </span>
          </div>
          <ProgressBar value={topic.progressPercent} />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <FileResourceCard
          title="Теория"
          description="Откройте файл прямо в браузере или скачайте его себе на устройство."
          file={topic.theoryFile}
        />
        <FileResourceCard
          title="Домашнее задание"
          description="Домашка доступна в отдельном файле. При необходимости откройте или скачайте его."
          file={topic.homeworkFile}
        />
      </div>

      <SectionCard
        title="Статусы номеров"
        description="Выберите цвет для каждого номера: зеленый, желтый или красный. Статусы сохраняются и доступны преподавателю."
      >
        <div className="space-y-4">
          {topic.numbers.map((number) => (
            <form
              key={number.id}
              action={setStudentNumberStatusAction}
              className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5"
            >
              <input type="hidden" name="topicId" value={topic.id} />
              <input type="hidden" name="homeworkNumberId" value={number.id} />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Домашнее задание</p>
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-2xl font-semibold text-slate-950">№ {number.number}</h3>
                    <HomeworkStatusBadge status={number.studentStatus?.status ?? null} />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {([HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED] as const).map(
                    (status) => {
                      const isActive = number.studentStatus?.status === status;
                      const meta = homeworkStatusMeta[status];

                      return (
                        <button
                          key={status}
                          type="submit"
                          name="status"
                          value={status}
                          className={cx(
                            "min-w-[190px] rounded-[22px] border px-4 py-4 text-left text-sm transition",
                            isActive
                              ? meta.cardClassName
                              : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                          )}
                        >
                          <p className="font-semibold">{meta.shortLabel}</p>
                          <p className="mt-2 leading-6">{meta.label}</p>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </form>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
