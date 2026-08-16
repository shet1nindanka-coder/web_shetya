import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

/*
 * Вкладка «Теория» у ученика (заменила «Общую инфу» 15.08.2026): файлы теории
 * всех тем в одном месте, в порядке тем. Файлы отдаются только через
 * защищённый /files/[fileId].
 */

export const dynamic = "force-dynamic";

export default async function StudentTheoryPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);

  const topicsWithTheory = data.topics.filter((topic) => topic.theoryFile);

  return (
    <div>
      <ShbzPageHeader
        kicker="Теория"
        title="Теория по темам"
        aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />}
      />

      {topicsWithTheory.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Файлов теории пока нет.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Как только учитель прикрепит теорию к темам, она появится здесь.
          </p>
        </div>
      ) : (
        <div className="shbz-card px-7 py-2">
          {topicsWithTheory.map((topic, index) => (
            <div
              key={topic.id}
              className="flex flex-wrap items-center justify-between gap-4 py-5"
              style={
                index < topicsWithTheory.length - 1
                  ? { borderBottom: "1px solid var(--shbz-row-border)" }
                  : undefined
              }
            >
              <div className="min-w-0">
                <div className="text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {topic.title}
                </div>
                {topic.description ? (
                  <p className="mt-1 max-w-2xl text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
                    {topic.description}
                  </p>
                ) : null}
              </div>
              <a
                href={`/files/${topic.theoryFile!.id}`}
                target="_blank"
                rel="noreferrer"
                className="shbz-btn-primary px-[20px] py-2.5 text-[13.5px] no-underline"
              >
                Читать теорию
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
