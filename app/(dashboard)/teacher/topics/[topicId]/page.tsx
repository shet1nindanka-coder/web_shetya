import { UserRole } from "@prisma/client";
import { deleteTopicFileAction, updateTopicAction } from "@/actions/topic";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { FileDropInput } from "@/components/file-drop-input";
import { FileResourceCard } from "@/components/file-resource-card";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
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
    <div className="space-y-5 sm:space-y-6">
      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "ui-notice-success rounded-[14px] px-4 py-3 text-sm font-medium sm:rounded-[16px]"
              : "ui-notice-error rounded-[14px] px-4 py-3 text-sm font-medium sm:rounded-[16px]"
          }
        >
          {notice.message}
        </div>
      ) : null}

      <PageHeader
        backHref="/teacher/topics"
        backLabel="← Ко всем темам"
        eyebrow="Тема"
        title={data.topic.title}
        description={data.topic.description}
        actions={
          <>
            <DeleteTopicDialog
              topicId={data.topic.id}
              topicTitle={data.topic.title}
              triggerLabel="Удалить тему"
              triggerClassName="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]"
            />
          </>
        }
      />

      <SectionCard title="Редактирование темы">
        <form action={updateTopicAction} className="space-y-4 sm:space-y-5" encType="multipart/form-data">
          <input type="hidden" name="topicId" value={data.topic.id} />

          <div className="ui-panel-soft space-y-3 rounded-[14px] p-3.5 sm:space-y-4 sm:rounded-[18px] sm:p-4">
            <h3 className="text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Основная информация</h3>

            <div className="grid gap-3 sm:gap-4">
              <label className="block space-y-1.5">
                <span className="ui-form-label">Название темы</span>
                <input
                  type="text"
                  name="title"
                  defaultValue={data.topic.title}
                  className="ui-input w-full rounded-[12px] px-3.5 py-2.5 sm:rounded-[14px]"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="ui-form-label">Описание</span>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={data.topic.description}
                  className="ui-input w-full rounded-[12px] px-3.5 py-2.5 sm:rounded-[14px]"
                  required
                />
              </label>
            </div>
          </div>

          <div className="ui-panel-soft space-y-3 rounded-[14px] p-3.5 sm:space-y-4 sm:rounded-[18px] sm:p-4">
            <h3 className="text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Номера</h3>
            <TopicNumbersField
              name="numbers"
              initialValue={numbersInput}
              rows={5}
              description="Можно вставлять длинные списки в несколько строк."
            />
          </div>

          <div className="ui-panel-soft space-y-3 rounded-[14px] p-3.5 sm:space-y-4 sm:rounded-[18px] sm:p-4">
            <h3 className="text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Файлы</h3>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="ui-card-soft space-y-3 rounded-[12px] p-3 sm:space-y-4 sm:rounded-[16px] sm:p-3.5">
                <FileResourceCard title="Теория" file={data.topic.theoryFile} showPreview={false} />
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
                    className="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-1.5 text-sm font-semibold transition"
                  >
                    Удалить файл теории
                  </button>
                ) : null}
              </div>

              <div className="ui-card-soft space-y-3 rounded-[12px] p-3 sm:space-y-4 sm:rounded-[16px] sm:p-3.5">
                <FileResourceCard title="Задания" file={data.topic.homeworkFile} showPreview={false} />
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
                    className="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-1.5 text-sm font-semibold transition"
                  >
                    Удалить файл заданий
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="ui-card-soft space-y-2.5 rounded-[14px] p-3.5 sm:rounded-[18px] sm:p-4">
            <h3 className="text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Сохранение</h3>
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
