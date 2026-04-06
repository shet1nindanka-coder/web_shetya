import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
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

      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="page-header-panel rounded-[28px] border border-white/70 bg-slate-950 px-5 py-6 text-white shadow-glow sm:rounded-[36px] sm:px-6 sm:py-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Общие темы, файлы и номера для всех учеников</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
            Создавайте темы, прикрепляйте файлы и редактируйте номера. Здесь собраны только материалы курса и
            инструменты для работы с ними.
          </p>
        </div>

        <div className="rounded-[28px] border border-brand-100 bg-white/90 p-5 shadow-glow sm:rounded-[36px] sm:p-6">
          <p className="text-sm font-medium text-slate-500">Работа с материалами</p>
          <p className="mt-4 text-2xl font-semibold text-slate-950 sm:text-3xl">На этой вкладке только темы, файлы, номера и ответы</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Числовую сводку по платформе можно посмотреть отдельно во вкладке статистики.
          </p>
        </div>
      </section>

      <SectionCard
        title="Создать новую тему"
        description="Добавьте тему, прикрепите файлы и укажите список номеров заданий."
      >
        <TopicCreateForm uploadMode={uploadMode} blobAccess={blobAccess} />
      </SectionCard>

      <SectionCard
        title="Все темы"
        description="Темы общие для всех учеников. Здесь можно открыть тему, отредактировать файлы, номера и ответы."
      >
        {data.topics.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-slate-950">Пока нет ни одной темы</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Начните с первой темы: добавьте описание, прикрепите файлы и укажите номера заданий.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.topics.map((topic) => (
              <article key={topic.id} className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-3">
                    <div>
                      <h2 className="font-display text-[1.55rem] font-semibold text-slate-950 sm:text-2xl">{topic.title}</h2>
                      <p className="mt-2 text-sm text-slate-500">{topic.totalNumbers} номеров</p>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{topic.description}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/teacher/topics/${topic.id}`}
                    className="ui-pressable inline-flex w-full justify-center rounded-[16px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
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
