import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { TeacherLessonComposeSwitch } from "@/components/teacher-lesson-compose-switch";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";

type TeacherStudentLessonComposePageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function TeacherStudentLessonComposePage({ params }: TeacherStudentLessonComposePageProps) {
  const user = await requireUser(UserRole.TEACHER);
  const { studentId } = await params;
  let data: Awaited<ReturnType<typeof getTeacherStudentDetail>>;

  try {
    data = await getTeacherStudentDetail(user, studentId);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Student not found:")) {
      notFound();
    }

    throw error;
  }

  // Номера, которые уже были у этого ученика на занятиях: помечаем, чтобы не выдать повторно.
  const [usedInLessons, profile, settings, conditions] = await Promise.all([
    prisma.lessonAssignmentItem
      .findMany({
        where: { participant: { studentId } },
        select: { homeworkNumberId: true }
      })
      .catch(() => []),
    prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { speed: true } }).catch(() => null),
    getSiteSettingsUncached(),
    // Условия задач для карточек ручного выбора; .catch — колонки может не быть до миграции.
    prisma.topicHomeworkNumber
      .findMany({ select: { id: true, conditionLatex: true } })
      .catch(() => [] as Array<{ id: string; conditionLatex: string | null }>)
  ]);
  const usedNumberIds = new Set(usedInLessons.map((item) => item.homeworkNumberId));
  const conditionById = new Map(conditions.map((entry) => [entry.id, entry.conditionLatex]));
  const aiAvailable = Boolean(settings.aiEnabled && settings.lessonPlanEnabled && getAiCheckConfig(settings));

  return (
    <SectionCard
      title="Составить занятие"
      description="По умолчанию задания подбирает ИИ; кнопкой можно переключиться на ручной выбор номеров."
    >
      {data.topics.length === 0 ? (
        <div className="ui-panel-soft rounded-[16px] border-dashed px-5 py-10 text-center">
          <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Темы пока не добавлены</p>
        </div>
      ) : (
        <TeacherLessonComposeSwitch
          prefix="/teacher"
          aiAvailable={aiAvailable}
          student={{ id: data.student.id, name: data.student.name, speed: profile?.speed ?? null }}
          formTopics={data.topics.map((topic) => ({ id: topic.id, title: topic.title }))}
          boardTopics={data.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            totalNumbers: topic.totalNumbers,
            numbers: topic.numbers.map((number) => ({
              id: number.id,
              number: number.number,
              status: number.studentStatus?.status ?? null,
              inLesson: usedNumberIds.has(number.id),
              conditionLatex: conditionById.get(number.id) ?? null
            }))
          }))}
        />
      )}
    </SectionCard>
  );
}
