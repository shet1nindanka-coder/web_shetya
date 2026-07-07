import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentTopicsRefreshBridge } from "@/components/student-topics-refresh-bridge";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentTopicsPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);

  return (
    <div>
      <StudentTopicsRefreshBridge />

      <ShbzPageHeader kicker="Темы" title="Список тем" aside={<ShbzNumberSearch />} />

      {data.topics.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Темы пока не добавлены
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data.topics.map((topic) => {
            const solvedCount = topic.greenCount + topic.yellowCount;
            const solvedPercent = topic.totalNumbers > 0 ? Math.round((solvedCount / topic.totalNumbers) * 100) : 0;
            const isCompleted = topic.totalNumbers > 0 && solvedCount === topic.totalNumbers;

            return (
              <article key={topic.id} className="shbz-card shbz-card-hover px-[26px] py-6" style={{ borderRadius: 18 }}>
                <div className="mb-[18px] flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
                        {topic.title}
                      </h2>
                      {isCompleted ? <span className="shbz-chip shbz-chip-green">Тема завершена</span> : null}
                    </div>
                    {topic.description ? (
                      <p className="ui-hint mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
                        {topic.description}
                      </p>
                    ) : null}
                    <p
                      className="mt-2 text-sm"
                      style={
                        isCompleted
                          ? { color: "var(--shbz-green-text)", fontWeight: 600 }
                          : { color: "var(--shbz-text-muted)" }
                      }
                    >
                      {isCompleted ? "Все номера в теме закрыты." : `${solvedCount} из ${topic.totalNumbers} задач выполнено`}
                    </p>
                  </div>

                  <Link href={`/student/topics/${topic.id}`} className="shbz-btn-primary shrink-0 px-6 py-3 text-[14.5px]">
                    Открыть
                  </Link>
                </div>
                <div className="shbz-progress-track">
                  <div className="shbz-progress-fill" style={{ width: `${solvedPercent}%` }} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
