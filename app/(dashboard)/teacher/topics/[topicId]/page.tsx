import Link from "next/link";
import { UserRole } from "@prisma/client";
import { updateTopicAction } from "@/actions/topic";
import { Badge } from "@/components/badge";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { FileResourceCard } from "@/components/file-resource-card";
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
            <Badge className="border-slate-200 bg-white text-slate-700">Номеров {data.stats.totalNumbers}</Badge>
            <Badge className="border-slate-200 bg-white text-slate-700">
              Ответов {data.stats.answersCount}/{data.stats.totalNumbers}
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
        <StatCard label="Номера" value={data.stats.totalNumbers} hint="Номеров заданий внутри темы." />
        <StatCard
          label="Файл теории"
          value={data.stats.theoryAttached ? "Есть" : "Нет"}
          hint="Прикреплен ли файл теории к этой теме."
        />
        <StatCard
          label="Файл заданий"
          value={data.stats.homeworkAttached ? "Есть" : "Нет"}
          hint="Прикреплен ли файл заданий к этой теме."
        />
        <StatCard
          label="Ответы"
          value={`${data.stats.answersCount}/${data.stats.totalNumbers}`}
          hint="Сколько номеров уже снабжены ответами."
        />
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
              <textarea
                name="numbers"
                rows={4}
                defaultValue={numbersInput}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                required
              />
              <p className="text-sm text-slate-500">
                Можно перечислять номера через запятую, пробел, перенос строки или указывать диапазон, например `1-5`.
              </p>
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
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-700"
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
            className="ui-pressable rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
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
    </div>
  );
}
