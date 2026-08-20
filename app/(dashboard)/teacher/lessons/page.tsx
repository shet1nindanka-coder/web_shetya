import Link from "next/link";
import { UserRole } from "@prisma/client";
import { LessonDeleteButton } from "@/components/lesson-delete-button";
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

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export default async function TeacherLessonsPage() {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const lessons = await getTeacherLessons(user);

  // Секции по расписанию: статус производный от startsAt+durationMinutes,
  // день берётся из startsAt (у уроков без даты — из createdAt).
  const now = new Date();
  const lessonDate = (lesson: (typeof lessons)[number]) => new Date(lesson.startsAt ?? lesson.createdAt);
  const todayLessons = lessons
    .filter((lesson) => isSameCalendarDay(lessonDate(lesson), now))
    .sort((left, right) => lessonDate(left).getTime() - lessonDate(right).getTime());
  const upcomingLessons = lessons
    .filter((lesson) => !todayLessons.includes(lesson) && lesson.status !== "FINISHED")
    .sort((left, right) => lessonDate(left).getTime() - lessonDate(right).getTime());
  const pastLessons = lessons
    .filter((lesson) => !todayLessons.includes(lesson) && lesson.status === "FINISHED")
    .sort((left, right) => lessonDate(right).getTime() - lessonDate(left).getTime());
  const sections = [
    { key: "today", title: "Сегодня", items: todayLessons },
    { key: "upcoming", title: "Ближайшие", items: upcomingLessons },
    { key: "past", title: "Прошедшие", items: pastLessons }
  ].filter((section) => section.items.length > 0);

  return (
    <div>
      <ShbzPageHeader
        kicker="Уроки"
        title="Уроки с ИИ-подбором"
        aside={
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`${prefix}/lessons/new`}
              className="shbz-btn-primary inline-block px-[22px] py-[12px] text-[14.5px] no-underline"
            >
              Составить урок
            </Link>
            <ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />
          </div>
        }
      />

      {lessons.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Уроков пока нет.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Нажмите «Составить урок», выберите группу или ученика — ИИ соберёт персональный набор задач каждому.
          </p>
          <Link
            href={`${prefix}/lessons/new`}
            className="shbz-btn-primary mt-5 inline-block px-[26px] py-[13px] text-[15px] no-underline"
          >
            Составить урок
          </Link>
        </div>
      ) : (
        <div className="space-y-9">
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="shbz-section-title">
                {section.title} · {section.items.length}
              </h2>
              <div className="space-y-3.5">
                {section.items.map((lesson) => (
            <article key={lesson.id} className="shbz-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {lesson.title}
                </h3>
                <p className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                  {formatDateTime(lesson.startsAt ?? lesson.createdAt)}
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
                {/* Чип «готово X/Y» показывается только пока подбор не завершён:
                    постоянное «готово 1/1» не несло информации (фидбек владельца). */}
                {lesson.readyCount < lesson.participantsCount ? (
                  <span className="shbz-chip shbz-chip-yellow">
                    подбор идёт {lesson.readyCount} / {lesson.participantsCount}
                  </span>
                ) : null}
                <span className="shbz-chip" style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }}>
                  {statusLabels[lesson.status] ?? lesson.status}
                </span>
                <Link href={`${prefix}/lessons/${lesson.id}`} className="shbz-btn-outline inline-block no-underline">
                  Открыть
                </Link>
                <a href={`${prefix}/lessons/${lesson.id}/pdf`} className="shbz-btn-outline inline-block no-underline">
                  PDF
                </a>
                <LessonDeleteButton lessonId={lesson.id} />
              </div>
            </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
