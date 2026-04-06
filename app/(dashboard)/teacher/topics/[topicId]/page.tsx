import Link from "next/link";
import { UserRole } from "@prisma/client";
import { deleteTopicFileAction, updateTopicAction } from "@/actions/topic";
import { Badge } from "@/components/badge";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { FileDropInput } from "@/components/file-drop-input";
import { FileResourceCard } from "@/components/file-resource-card";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TopicEditSubmitButton } from "@/components/topic-edit-submit-button";
import { TopicAnswerManager } from "@/components/topic-answer-manager";
import { TopicNumbersField } from "@/components/topic-numbers-field";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicDetail } from "@/lib/platform-data";

type TeacherTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const topicEditNotices = {
  saved: {
    tone: "success",
    message: "Изменения по теме сохранены."
  },
  theoryDeleted: {
    tone: "success",
    message: "Файл теории удалён."
  },
  homeworkDeleted: {
    tone: "success",
    message: "Файл заданий удалён."
  },
  invalid: {
    tone: "error",
    message: "Проверьте форму: название, описание и список номеров обязательны."
  },
  upload: {
    tone: "error",
    message: "Не удалось обработать файл. Попробуйте ещё раз или обновите страницу."
  },
  fileDelete: {
    tone: "error",
    message: "Не удалось удалить файл. Повторите попытку."
  },
  save: {
    tone: "error",
    message: "Не удалось сохранить изменения. Проверьте подключение к базе данных и повторите попытку."
  }
} as const;

export default async function TeacherTopicPage({ params, searchParams }: TeacherTopicPageProps) {
  await requireUser(UserRole.TEACHER);
  const { topicId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = typeof resolvedSearchParams.saved === "string" ? resolvedSearchParams.saved : undefined;
  const fileDeleted =
    typeof resolvedSearchParams.fileDeleted === "string" ? resolvedSearchParams.fileDeleted : undefined;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;
  const noticeKey =
    saved === "1"
      ? "saved"
      : fileDeleted === "theory"
        ? "theoryDeleted"
        : fileDeleted === "homework"
          ? "homeworkDeleted"
      : error && error in topicEditNotices
        ? (error as Exclude<keyof typeof topicEditNotices, "saved">)
        : null;
  const notice = noticeKey ? topicEditNotices[noticeKey] : null;
  const data = await getTeacherTopicDetail(topicId);
  const numbersInput = data.topic.homeworkNumbers.map((number) => number.number).join(", ");

  return (
    <div className="space-y-8">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-900"
              : "rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-900"
          }
        >
          {notice.message}
        </div>
      ) : null}

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
          triggerClassName="rounded-[14px] border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Номера" value={data.stats.totalNumbers} />
        <StatCard
          label="Файл теории"
          value={data.stats.theoryAttached ? "Есть" : "Нет"}
        />
        <StatCard
          label="Файл заданий"
          value={data.stats.homeworkAttached ? "Есть" : "Нет"}
        />
        <StatCard
          label="Ответы"
          value={`${data.stats.answersCount}/${data.stats.totalNumbers}`}
        />
      </div>

      <SectionCard title="Редактирование темы">
        <form action={updateTopicAction} className="space-y-6" encType="multipart/form-data">
          <input type="hidden" name="topicId" value={data.topic.id} />

          <div className="space-y-4 rounded-[26px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">Основная информация</h3>
            </div>

            <div className="grid gap-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Название темы</span>
                <input
                  type="text"
                  name="title"
                  defaultValue={data.topic.title}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">Описание</span>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={data.topic.description}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-brand-400 focus:bg-white"
                  required
                />
              </label>
            </div>
          </div>

          <div className="space-y-4 rounded-[26px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">Номера</h3>
            </div>

            <TopicNumbersField
              name="numbers"
              initialValue={numbersInput}
              rows={6}
              description="Можно вставлять длинные списки в несколько строк."
            />
          </div>

          <div className="space-y-4 rounded-[26px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">Файлы</h3>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4">
                <FileResourceCard
                  title="Теория"
                  file={data.topic.theoryFile}
                  showPreview={false}
                />
                <FileDropInput
                  name="theoryFile"
                  label="Заменить файл теории"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  helperText="Можно выбрать новый файл или перетащить его сюда."
                />
                {data.topic.theoryFile ? (
                  <button
                    type="submit"
                    formAction={deleteTopicFileAction}
                    formNoValidate
                    formEncType="application/x-www-form-urlencoded"
                    name="fileKind"
                    value="theory"
                    className="ui-pressable rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Удалить файл теории
                  </button>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-4">
                <FileResourceCard
                  title="Задания"
                  file={data.topic.homeworkFile}
                  showPreview={false}
                />
                <FileDropInput
                  name="homeworkFile"
                  label="Заменить файл заданий"
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  helperText="Можно выбрать новый файл или перетащить его сюда."
                />
                {data.topic.homeworkFile ? (
                  <button
                    type="submit"
                    formAction={deleteTopicFileAction}
                    formNoValidate
                    formEncType="application/x-www-form-urlencoded"
                    name="fileKind"
                    value="homework"
                    className="ui-pressable rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Удалить файл заданий
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-[26px] border border-slate-200 bg-white p-5">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">Сохранение</h3>
            </div>
            <TopicEditSubmitButton />
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Ответы к заданиям" description="LaTeX-ответы к номерам.">
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
