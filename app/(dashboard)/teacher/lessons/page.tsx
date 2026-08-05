import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getTeacherLessons } from "@/lib/platform-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PLANNED: "Запланирован",
  ACTIVE: "Идёт",
  FINISHED: "Завершён"
};

export default async function TeacherLessonsPage() {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const lessons = await getTeacherLessons();

  return (
    <div>
      <ShbzPageHeader kicker="Уроки" title="Уроки с ИИ-подбором" aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />} />

      {lessons.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Уроков пока нет.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Откройте группу и нажмите «Составить урок» — ИИ соберёт персональный набор задач каждому ученику. Урок для одного ученика собирается во вкладке «Составить занятие» на его странице.
          </p>
          <Link href={`${prefix}/groups`} className="shbz-btn-primary mt-5 inline-block px-[26px] py-[13px] text-[15px] no-underline">
            К группам
          </Link>
        </div>
      ) : (
        <div className="space-y-3.5">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="shbz-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {lesson.title}
                </h3>
                <p className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                  {formatDateTime(lesson.createdAt)}
                  {lesson.groupName ? ` · ${lesson.groupName}` : lesson.soloStudentName ? ` · ${lesson.soloStudentName}` : ""} · {lesson.durationMinutes} мин ·{" "}
                  {lesson.participantsCount}{" "}
                  {lesson.participantsCount === 1 ? "ученик" : lesson.participantsCount < 5 ? "ученика" : "учеников"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {lesson.failedCount > 0 ? (
                  <span className="shbz-chip" style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}>
                    ошибок: {lesson.failedCount}
                  </span>
                ) : null}
                {lesson.resultsTotal > 0 ? (
                  <span
                    className={`shbz-chip ${lesson.resultsMarked === lesson.resultsTotal ? "shbz-chip-green" : "shbz-chip-yellow"}`}
                  >
                    итоги {lesson.resultsMarked} / {lesson.resultsTotal}
                  </span>
                ) : null}
                <span
                  className={`shbz-chip ${lesson.readyCount === lesson.participantsCount ? "shbz-chip-green" : "shbz-chip-yellow"}`}
                >
                  готово {lesson.readyCount} / {lesson.participantsCount}
                </span>
                <span className="shbz-chip" style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}>
                  {statusLabels[lesson.status] ?? lesson.status}
                </span>
                <Link href={`${prefix}/lessons/${lesson.id}`} className="shbz-btn-outline inline-block no-underline">
                  Открыть
                </Link>
                <a href={`${prefix}/lessons/${lesson.id}/pdf`} className="shbz-btn-outline inline-block no-underline">
                  PDF
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
