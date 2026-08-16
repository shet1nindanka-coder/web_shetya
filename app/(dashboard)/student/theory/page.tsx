import { UserRole } from "@prisma/client";
import { FileFullscreenPreview } from "@/components/file-fullscreen-preview";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentTheoryLibrary } from "@/lib/platform-data";
import { formatDateTime, formatFileSize } from "@/lib/utils";

/*
 * Вкладка «Теория» у ученика (заменила «Общую инфу» 15.08.2026): файлы теории
 * всех тем. Предпросмотр открывается по кнопке во весь экран — сразу ничего
 * не грузим. Файлы отдаются только через защищённый /files/[fileId].
 */

export const dynamic = "force-dynamic";

export default async function StudentTheoryPage() {
  await requireUser(UserRole.STUDENT);
  const topics = await getStudentTheoryLibrary();

  return (
    <div>
      <ShbzPageHeader
        kicker="Теория"
        title="Теория по темам"
        aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />}
      />

      {topics.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Файлов теории пока нет.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Как только учитель прикрепит теорию к темам, она появится здесь.
          </p>
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {topics.map((topic) => (
            <article key={topic.id} className="shbz-card flex flex-col gap-4 shbz-section-pad">
              <div className="min-w-0">
                <p className="shbz-kicker">{topic.title}</p>
                <h3 className="mt-1 break-words text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {topic.theoryFile!.originalName}
                </h3>
                {topic.description ? (
                  <p className="ui-hint mt-1.5 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
                    {topic.description}
                  </p>
                ) : null}
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--shbz-kicker)" }}>
                  {formatFileSize(topic.theoryFile!.size)} · {formatDateTime(topic.theoryFile!.uploadedAt)}
                </p>
              </div>
              <div className="mt-auto">
                <FileFullscreenPreview fileId={topic.theoryFile!.id} fileName={topic.theoryFile!.originalName} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
