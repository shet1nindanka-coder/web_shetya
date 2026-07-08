import { UserRole } from "@prisma/client";
import { SectionCard } from "@/components/section-card";
import { TeacherHomeworkReviewList } from "@/components/teacher-homework-review-list";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentHomeworks } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type TeacherStudentPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentPage({ params }: TeacherStudentPageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;
  const { assignmentsEnabled, assignments } = await getTeacherStudentHomeworks(studentId);

  return (
    <SectionCard title="Проверка домашних заданий">
      {!assignmentsEnabled ? (
        <div className="ui-notice-warning rounded-[12px] px-4 py-3 text-sm">
          Раздел ДЗ появится после обновления базы данных до актуальной версии.
        </div>
      ) : assignments.length === 0 ? (
        <div className="ui-panel-soft rounded-[28px] border-dashed px-5 py-10 text-center">
          <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">ДЗ пока не выдано</p>
          <p className="ui-copy-muted mt-2 text-sm">Выдайте первое ДЗ во вкладке «Выдать ДЗ».</p>
        </div>
      ) : (
        <TeacherHomeworkReviewList
          studentId={studentId}
          assignments={assignments.map((assignment) => ({
            id: assignment.id,
            label: assignment.label,
            topicId: assignment.topicId,
            topicTitle: assignment.topicTitle,
            deadlineAt: toIsoDateTimeString(assignment.deadlineAt),
            createdAt: toIsoDateTimeString(assignment.createdAt) ?? "",
            totalNumbers: assignment.totalNumbers,
            markedCount: assignment.markedCount,
            redCount: assignment.redCount,
            solvedCount: assignment.solvedCount,
            solvedPercent: assignment.solvedPercent,
            photos: assignment.photos.map((photo) => ({
              id: photo.id,
              fileId: photo.fileId,
              originalName: photo.originalName
            })),
            aiCheck: assignment.latestCheck
              ? {
                  status: assignment.latestCheck.status,
                  checkedAt: toIsoDateTimeString(assignment.latestCheck.checkedAt),
                  results: assignment.latestCheck.results.map((result) => ({
                    number: result.number,
                    verdict: result.verdict,
                    recognizedAnswer: result.recognizedAnswer,
                    comment: result.comment,
                    copySuspected: result.copySuspected,
                    copyReason: result.copyReason
                  }))
                }
              : null,
            numbers: assignment.numbers.map((number) => ({
              homeworkNumberId: number.homeworkNumberId,
              number: number.number,
              status: number.status,
              note: number.note
            }))
          }))}
        />
      )}
    </SectionCard>
  );
}
