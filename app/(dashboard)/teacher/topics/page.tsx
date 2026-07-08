import Link from "next/link";
import { UserRole } from "@prisma/client";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
import { ShbzNavCard } from "@/components/shbz-nav-card";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
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

function pluralizeNumbers(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} номер`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} номера`;
  }

  return `${count} номеров`;
}

export default async function TeacherTopicsPage({ searchParams }: TeacherTopicsPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const isDeveloper = user.role === UserRole.DEVELOPER;
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
    <div>
      <ShbzPageHeader
        kicker="Темы"
        title="Материалы и номера"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "shbz-notice-success mb-8 px-5 py-4 text-sm font-medium"
              : "shbz-notice-error mb-8 px-5 py-4 text-sm font-medium"
          }
        >
          {notice.message}
        </div>
      ) : null}

      {isDeveloper ? (
        <section id="create-topic" className="scroll-mt-24">
          <h2 className="shbz-section-title">Создать новую тему</h2>
          <div className="shbz-card shbz-section-pad">
            <TopicCreateForm uploadMode={uploadMode} blobAccess={blobAccess} />
          </div>
        </section>
      ) : null}

      <section className={isDeveloper ? "mt-11" : undefined}>
        <h2 className="shbz-section-title" style={{ marginBottom: 22 }}>
          Все темы
        </h2>

        {data.topics.length === 0 ? (
          <div className="shbz-card px-6 py-10 text-center">
            <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Пока нет ни одной темы
            </p>
          </div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {data.topics.map((topic) => (
              <ShbzNavCard
                key={topic.id}
                kicker="Тема"
                title={topic.title}
                meta={`${pluralizeNumbers(topic.totalNumbers)} · ${topic.studentsWithActivity} активных`}
                footer={
                  <>
                    <Link href={`/teacher/topics/${topic.id}`} className="shbz-btn-primary px-[18px] py-2.5 text-[13px]">
                      Открыть
                    </Link>
                    {isDeveloper ? (
                      <DeleteTopicDialog topicId={topic.id} topicTitle={topic.title} triggerClassName="shbz-btn-danger" />
                    ) : null}
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
