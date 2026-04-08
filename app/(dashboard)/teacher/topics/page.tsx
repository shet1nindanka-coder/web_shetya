import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { TopicCreateForm } from "@/components/topic-create-form";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";
import { getBlobAccessMode, getStorageBackend } from "@/lib/storage";

type TeacherTopicsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const topicNotices = {
  created: {
    tone: "success",
    message: "Новая тема успешно создана."
  },
  deleted: {
    tone: "success",
    message: "Тема успешно удалена."
  },
  invalid: {
    tone: "error",
    message: "Проверьте форму: название, описание, файлы и список номеров обязательны."
  },
  upload: {
    tone: "error",
    message: "Не удалось загрузить файлы. Проверьте настройки storage и повторите попытку."
  },
  save: {
    tone: "error",
    message: "Не удалось сохранить тему в базе данных. Проверьте подключение к PostgreSQL и логи сервера."
  },
  delete: {
    tone: "error",
    message: "Не удалось удалить тему. Проверьте логи сервера и повторите попытку."
  }
} as const;

export default async function TeacherTopicsPage({ searchParams }: TeacherTopicsPageProps) {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();
  const uploadMode = getStorageBackend() === "blob" ? "blob" : "local";
  const blobAccess = getBlobAccessMode();
  const resolvedSearchParams = (await searchParams) ?? {};
  const created = typeof resolvedSearchParams.created === "string" ? resolvedSearchParams.created : undefined;
  const deleted = typeof resolvedSearchParams.deleted === "string" ? resolvedSearchParams.deleted : undefined;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;
  const noticeKey =
    created === "1"
      ? "created"
      : deleted === "1"
        ? "deleted"
        : error && error in topicNotices
          ? (error as keyof typeof topicNotices)
          : null;
  const notice = noticeKey ? topicNotices[noticeKey] : null;

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
        eyebrow="Темы"
        title="Материалы и номера"
        description="Создание тем, загрузка файлов и настройка ответов в одном рабочем разделе."
        metrics={[
          { label: "Темы", value: data.stats.totalTopics },
          { label: "Файлы", value: data.stats.totalFiles },
          { label: "Номера", value: data.stats.totalNumbers }
        ]}
        actions={
          <a
            href="#create-topic"
            className="ui-pressable ui-button-primary inline-flex rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]"
          >
            Создать тему
          </a>
        }
        aside={
          <div className="ui-page-header-panel rounded-[14px] p-3.5 sm:rounded-[16px] sm:p-4">
            <p className="ui-kicker">Содержимое раздела</p>
            <p className="mt-1.5 font-display text-[1.3rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.5rem]">
              {data.topics.length} тем
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--theme-text-muted)]">Каждая тема объединяет материалы, номера и ответы.</p>
          </div>
        }
      />


      <SectionCard title="Создать новую тему" description="Название, файлы и список номеров сохраняются одной формой." className="scroll-mt-20">
        <div id="create-topic" className="scroll-mt-20">
          <TopicCreateForm uploadMode={uploadMode} blobAccess={blobAccess} />
        </div>
      </SectionCard>

      <SectionCard title="Все темы">
        {data.topics.length === 0 ? (
          <div className="ui-panel-soft rounded-[16px] border-dashed px-4 py-8 text-center sm:rounded-[20px] sm:px-5 sm:py-10">
            <p className="font-display text-lg font-semibold text-[var(--theme-text-strong)] sm:text-xl">Пока нет ни одной темы</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => (
              <article key={topic.id} className="ui-surface rounded-[14px] border p-3.5 sm:rounded-[16px] sm:p-4">
                <div className="flex flex-col gap-3">
                  <div className="space-y-1.5">
                    <h2 className="font-display text-[1.15rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.35rem]">
                      {topic.title}
                    </h2>
                    {topic.description ? (
                      <p className="ui-hint text-sm leading-relaxed text-[var(--theme-text-muted)]">{topic.description}</p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Номера</p>
                      <p className="ui-mini-stat-card-value mt-1.5">{topic.totalNumbers}</p>
                    </div>
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Активных</p>
                      <p className="ui-mini-stat-card-value mt-1.5">{topic.studentsWithActivity}</p>
                    </div>
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Статусов</p>
                      <p className="ui-mini-stat-card-value mt-1.5">{topic.markedCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                  <Link
                    href={`/teacher/topics/${topic.id}`}
                    className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
                  >
                    Открыть и редактировать
                  </Link>
                  <DeleteTopicDialog
                    topicId={topic.id}
                    topicTitle={topic.title}
                    triggerClassName="ui-pressable ui-button-danger inline-flex w-full justify-center rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:w-auto sm:rounded-[12px]"
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
