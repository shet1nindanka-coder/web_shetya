import { UserRole } from "@prisma/client";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentLessonView } from "@/components/student-lesson-view";
import { requireUser } from "@/lib/auth";
import { finalizeRecentlyFinishedLessons } from "@/lib/lesson-finalize";
import { getStudentLiveLesson } from "@/lib/platform-data";
import { toStudentFacingResult } from "@/lib/solution-check-student-view";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StudentLessonPage() {
  const user = await requireUser(UserRole.STUDENT);
  await finalizeRecentlyFinishedLessons({ studentId: user.id });
  const { active, upcoming } = await getStudentLiveLesson(user.id);

  if (!active) {
    return (
      <div className="min-h-[70vh]">
        <ShbzPageHeader kicker="Классная работа" title="Урок" />

        <section className="shbz-card shbz-section-pad">
          <h2 className="text-[20px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            Сейчас урока нет
          </h2>
          {upcoming ? (
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
              Ближайшее занятие «{upcoming.title}» — {formatDateTime(upcoming.startsAt)}
              {upcoming.groupName ? ` · ${upcoming.groupName}` : ""}. Когда урок начнётся, здесь появится
              классная работа.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
              Когда учитель назначит занятие и оно начнётся, здесь появится классная работа.
            </p>
          )}
          <p className="ui-hint mt-3 text-xs" style={{ color: "var(--shbz-kicker)" }}>
            Страница обновится сама — держать её открытой не обязательно.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh]">
      <ShbzPageHeader
        kicker={`Классная работа${active.groupName ? ` · ${active.groupName}` : ""}`}
        title={active.title}
      />

      <StudentLessonView
        lessonId={active.lessonId}
        startsAt={active.startsAt ? active.startsAt.toISOString() : null}
        durationMinutes={active.durationMinutes}
        items={active.items.map((item) => {
          const submission = item.submission;
          // Тот же урезанный вид, что отдаёт GET /api/student/lesson-submissions:
          // UNCERTAIN получает нейтральный комментарий, диагностика не отдаётся.
          const facing =
            submission && submission.status === "DONE" && submission.verdict
              ? toStudentFacingResult({
                  number: item.number,
                  verdict: submission.verdict as "CORRECT" | "INCORRECT" | "UNCERTAIN",
                  recognizedAnswer: submission.recognizedAnswer,
                  comment: submission.comment
                })
              : null;

          return {
            id: item.id,
            number: item.number,
            isExtra: item.isExtra,
            result: item.result,
            conditionLatex: item.conditionLatex,
            topicTitle: item.topicTitle,
            submission: submission
              ? {
                  id: submission.id,
                  itemId: item.id,
                  status: submission.status,
                  verdict: facing?.verdict ?? null,
                  recognizedAnswer: facing?.recognizedAnswer ?? null,
                  comment: facing?.comment ?? null,
                  error: submission.status === "FAILED" ? submission.error : null,
                  submittedAt: submission.submittedAt.toISOString(),
                  checkedAt: submission.checkedAt ? submission.checkedAt.toISOString() : null
                }
              : null
          };
        })}
      />
    </div>
  );
}
