import { UserRole } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkDoneBadge, HomeworkOverdueBadge } from "@/components/deadline-list";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentHomeworkCheck } from "@/components/student-homework-check";
import { StudentHomeworkPhotos } from "@/components/student-homework-photos";
import { StudentSingleNumberCard } from "@/components/student-single-number-card";
import { requireUser } from "@/lib/auth";
import { getStudentHomeworks } from "@/lib/platform-data";
import { formatDateTime, isHomeworkOverdue, toIsoDateTimeString } from "@/lib/utils";

type StudentHomeworkPageProps = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export default async function StudentHomeworkPage({ params }: StudentHomeworkPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { assignmentId } = await params;
  const { assignmentsEnabled, notesEnabled, assignments } = await getStudentHomeworks(user.id);
  const assignment = assignments.find((entry) => entry.id === assignmentId);

  if (!assignmentsEnabled || !assignment) {
    notFound();
  }

  const deadlineLabel = assignment.deadlineAt ? formatDateTime(assignment.deadlineAt) : null;
  const deadlineAtIso = toIsoDateTimeString(assignment.deadlineAt);

  return (
    <div className="min-h-[70vh]">
      <Link
        href="/student/homeworks"
        className="mb-5 inline-block text-sm font-semibold transition hover:opacity-75"
        style={{ color: "var(--shbz-kicker)" }}
      >
        ← Ко всем ДЗ
      </Link>

      <ShbzPageHeader kicker={assignment.topicTitle} title={assignment.label} />

      <p className="-mt-7 mb-8 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
        <span>
          {deadlineLabel ? `Дедлайн до ${deadlineLabel} · ` : ""}
          Выполнено {assignment.solvedCount} из {assignment.totalNumbers}
        </span>
        {assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers ? (
          <HomeworkDoneBadge />
        ) : null}
        {isHomeworkOverdue(
          deadlineAtIso,
          assignment.totalNumbers > 0 && assignment.solvedCount === assignment.totalNumbers
        ) ? (
          <HomeworkOverdueBadge />
        ) : null}
      </p>

      <section className="mb-8">
        <h2 className="shbz-section-title">Фото решений</h2>
        <StudentHomeworkPhotos
          assignmentId={assignment.id}
          photos={assignment.photos.map((photo) => ({
            id: photo.id,
            fileId: photo.fileId,
            originalName: photo.originalName
          }))}
        />
      </section>

      <section className="mb-8">
        <h2 className="shbz-section-title">Автоматическая проверка</h2>
        <StudentHomeworkCheck
          assignmentId={assignment.id}
          hasPhotos={assignment.photos.length > 0}
          initialCheck={
            assignment.latestCheck
              ? {
                  id: assignment.latestCheck.id,
                  status: assignment.latestCheck.status,
                  error: assignment.latestCheck.error,
                  checkedAt: toIsoDateTimeString(assignment.latestCheck.checkedAt),
                  results: assignment.latestCheck.results.map((result) => ({
                    number: result.number,
                    verdict: result.verdict,
                    recognizedAnswer: result.recognizedAnswer,
                    comment: result.comment
                  }))
                }
              : null
          }
        />
      </section>

      <section className="space-y-5">
        <h2 className="shbz-section-title">Номера</h2>
        {assignment.numbers.map((number) => (
          <div key={number.homeworkNumberId} id={`number-${number.number}`} className="scroll-mt-28">
          <StudentSingleNumberCard
            topicId={assignment.topicId}
            homeworkNumberId={number.homeworkNumberId}
            number={number.number}
            conditionLatex={number.conditionLatex}
            answerLatex={number.answerLatex}
            initialStatus={number.status}
            initialNote={number.note}
            deadlineAt={deadlineAtIso}
            notesEnabled={notesEnabled}
          />
          </div>
        ))}
      </section>
    </div>
  );
}
