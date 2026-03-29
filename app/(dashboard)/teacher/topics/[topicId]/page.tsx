import Link from "next/link";
import { UserRole } from "@prisma/client";
import { updateTopicAction } from "@/actions/topic";
import { Badge } from "@/components/badge";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { FileResourceCard } from "@/components/file-resource-card";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TopicAnswerManager } from "@/components/topic-answer-manager";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicDetail } from "@/lib/platform-data";

type TeacherTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
};

export default async function TeacherTopicPage({ params }: TeacherTopicPageProps) {
  await requireUser(UserRole.TEACHER);
  const { topicId } = await params;
  const data = await getTeacherTopicDetail(topicId);
  const numbersInput = data.topic.homeworkNumbers.map((number) => number.number).join(", ");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/teacher/topics" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
            ← Ко всем темам
          </Link>
          <h1 className="font-display mt-3 text-4xl font-semibold text-slate-950">{data.topic.title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{data.topic.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge className="border-slate-200 bg-white text-slate-700">Учеников {data.stats.totalStudents}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-700">Номеров {data.stats.numbersPerStudent}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-700">
              Заполненность {data.stats.progressPercent}%
            </Badge>
          </div>
        </div>

        <DeleteTopicDialog
          topicId={data.topic.id}
          topicTitle={data.topic.title}
          triggerLabel="Удалить тему"
          triggerClassName="rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ученики" value={data.stats.totalStudents} hint="Учеников видят эту тему в своих кабинетах." />
        <StatCard label="Номера" value={data.stats.numbersPerStudent} hint="Номеров заданий внутри темы." />
        <StatCard label="Зеленые" value={data.stats.greenCount} hint="Все зеленые статусы по теме." />
        <StatCard label="Заполненность" value={`${data.stats.progressPercent}%`} hint="Насколько ученики отметили номера по теме." />
      </div>

      <SectionCard
        title="Редактирование темы"
        description="Здесь можно менять название, описание, номера, а также заменять и удалять файлы."
      >
        <form action={updateTopicAction} className="space-y-6" encType="multipart/form-data">
          <input type="hidden" name="topicId" value={data.topic.id} />

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Название темы</span>
              <input
                type="text"
                name="title"
                defaultValue={data.topic.title}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Описание</span>
              <textarea
                name="description"
                rows={4}
                defaultValue={data.topic.description}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
            </label>

            <label className="block space-y-2 lg:col-span-2">
              <span className="text-sm font-medium text-slate-700">Номера заданий</span>
              <input
                type="text"
                name="numbers"
                defaultValue={numbersInput}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
              <p className="text-sm text-slate-500">Можно перечислять номера через запятую, пробел или указывать диапазон, например `1-5`.</p>
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <FileResourceCard
                title="Теория"
                description="Текущий файл теории по теме."
                file={data.topic.theoryFile}
              />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Заменить файл теории</span>
                <input
                  type="file"
                  name="theoryFile"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" name="removeTheoryFile" className="h-4 w-4" />
                Удалить текущий файл теории при сохранении
              </label>
            </div>

            <div className="space-y-4">
              <FileResourceCard
                title="Задания"
                description="Текущий файл заданий по теме."
                file={data.topic.homeworkFile}
              />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Заменить файл заданий</span>
                <input
                  type="file"
                  name="homeworkFile"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" name="removeHomeworkFile" className="h-4 w-4" />
                Удалить текущий файл заданий при сохранении
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Сохранить изменения
          </button>
        </form>
      </SectionCard>

      <SectionCard
        title="Ответы к заданиям"
        description="Для каждого номера можно сохранить текстовый ответ с LaTeX-формулами. Ученик увидит его в виде spoiler-блока на странице темы."
      >
        <TopicAnswerManager
          topicId={data.topic.id}
          numbers={data.topic.homeworkNumbers.map((number) => ({
            id: number.id,
            number: number.number,
            answerLatex: number.answerLatex
          }))}
        />
      </SectionCard>

      <SectionCard
        title="Прогресс учеников по теме"
        description="Для каждого ученика видны статусы всех номеров и общий прогресс по этой теме."
      >
        {data.students.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Учеников пока нет</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              После добавления учеников в систему здесь появится их индивидуальный прогресс по теме.
            </p>
          </div>
        ) : (
        <div className="space-y-4">
          {data.students.map((student) => (
            <article key={student.id} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-slate-950">{student.name}</h2>
                    <p className="mt-2 text-sm text-slate-500">{student.email}</p>
                    <Link
                      href={`/teacher/students/${student.id}`}
                      className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                    >
                      Смотреть успехи ученика
                    </Link>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Зеленые</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-700">{student.greenCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Желтые</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-700">{student.yellowCount}</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Красные</p>
                      <p className="mt-2 text-2xl font-semibold text-rose-700">{student.redCount}</p>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-md space-y-3 rounded-[24px] border border-white bg-white p-4">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Заполненность статусов</span>
                    <span className="font-semibold text-slate-950">{student.progressPercent}%</span>
                  </div>
                  <ProgressBar value={student.progressPercent} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {student.numbers.map((number) => (
                  <div key={number.id} className="rounded-[24px] border border-white bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-slate-950">№ {number.number}</p>
                      <HomeworkStatusBadge status={number.status} />
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
