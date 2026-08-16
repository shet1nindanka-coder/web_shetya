import { UserRole } from "@prisma/client";
import { FileResourceCard } from "@/components/file-resource-card";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentTheoryLibrary } from "@/lib/platform-data";

/*
 * Вкладка «Теория» у ученика (заменила «Общую инфу» 15.08.2026): файлы теории
 * всех тем с предпросмотром и скачиванием. Файлы отдаются только через
 * защищённый /files/[fileId].
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
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          {topics.map((topic) => (
            <FileResourceCard
              key={topic.id}
              title={topic.title}
              description={topic.description || undefined}
              file={topic.theoryFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
