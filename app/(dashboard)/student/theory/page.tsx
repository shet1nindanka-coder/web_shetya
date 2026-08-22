import { UserRole } from "@prisma/client";
import { FileFullscreenPreview } from "@/components/file-fullscreen-preview";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentTheoryLibrary } from "@/lib/platform-data";

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
        <div className="ui-enter grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          {topics.map((topic) => (
            <article key={topic.id} className="shbz-card flex flex-col gap-4 shbz-section-pad">
              {/* Решение владельца: в карточке только название темы и кнопка —
                  кикер, описание, размер и дата файла убраны. */}
              <div className="min-w-0">
                <h3 className="break-words text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {topic.title}
                </h3>
              </div>
              <div className="mt-auto">
                <FileFullscreenPreview fileId={topic.theoryFile!.id} fileName={topic.title} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
