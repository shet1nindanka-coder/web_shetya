import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { TeacherLessonComposeBoard } from "@/components/teacher-lesson-compose-board";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";

type TeacherStudentLessonComposePageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TeacherStudentLessonComposePage({ params }: TeacherStudentLessonComposePageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;
  let data: Awaited<ReturnType<typeof getTeacherStudentDetail>>;

  try {
    data = await getTeacherStudentDetail(studentId);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Student not found:")) {
      notFound();
    }

    throw error;
  }

  // Номера, которые уже были у этого ученика на занятиях: помечаем, чтобы не выдать повторно.
  const usedInLessons = await prisma.lessonAssignmentItem
    .findMany({
      where: { participant: { studentId } },
      select: { homeworkNumberId: true }
    })
    .catch(() => []);
  const usedNumberIds = new Set(usedInLessons.map((item) => item.homeworkNumberId));

  return (
    <SectionCard
      title="Составить занятие"
      description="Выберите номера для урока или доверьте подбор ИИ. Итоги по каждому номеру отмечаются на доске занятия."
    >
      {data.topics.length === 0 ? (
        <div className="ui-panel-soft rounded-[16px] border-dashed px-5 py-10 text-center">
          <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Темы пока не добавлены</p>
        </div>
      ) : (
        <TeacherLessonComposeBoard
          studentId={data.student.id}
          topics={data.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            totalNumbers: topic.totalNumbers,
            numbers: topic.numbers.map((number) => ({
              id: number.id,
              number: number.number,
              status: number.studentStatus?.status ?? null,
              inLesson: usedNumberIds.has(number.id)
            }))
          }))}
        />
      )}
    </SectionCard>
  );
}
