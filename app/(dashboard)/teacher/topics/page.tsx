import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
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
            className="ui-pressable ui-button-primary inline-flex rounded-[14px] px-4 py-2.5 text-sm font-semibold transition"
          >
            Создать тему
          </a>
        }
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">Содержимое раздела</p>
            <p className="mt-2 font-display text-[1.7rem] font-semibold text-[var(--theme-text-strong)]">
              {data.topics.length} тем
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">Каждая тема объединяет материалы, номера и ответы к заданиям.</p>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Файлы" value={data.stats.totalFiles} />
        <StatCard label="Номера" value={data.stats.totalNumbers} />
        <StatCard label="Ученики" value={data.stats.totalStudents} />
      </div>

      <SectionCard title="Создать новую тему" description="Название, файлы и список номеров сохраняются одной формой." className="scroll-mt-24">
        <div id="create-topic" className="scroll-mt-24">
        <TopicCreateForm uploadMode={uploadMode} blobAccess={blobAccess} />
        </div>
      </SectionCard>

      <SectionCard title="Все темы">
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Пока нет ни одной темы</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => (
              <article key={topic.id} className="ui-surface rounded-[20px] border p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="space-y-2">
                    <h2 className="font-display text-[1.45rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.7rem]">
                      {topic.title}
                    </h2>
                    {topic.description ? (
                      <p className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">{topic.description}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Номера</p>
                      <p className="ui-mini-stat-card-value mt-2">{topic.totalNumbers}</p>
                    </div>
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Активных учеников</p>
                      <p className="ui-mini-stat-card-value mt-2">{topic.studentsWithActivity}</p>
                    </div>
                    <div className="ui-mini-stat-card">
                      <p className="ui-mini-stat-card-label">Отмечено статусов</p>
                      <p className="ui-mini-stat-card-value mt-2">{topic.markedCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={`/teacher/topics/${topic.id}`}
                    className="ui-pressable ui-button-primary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition sm:w-auto"
                  >
                    Открыть и редактировать
                  </Link>
                  <DeleteTopicDialog topicId={topic.id} topicTitle={topic.title} />
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
