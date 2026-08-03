import { UserRole } from "@prisma/client";
import { SectionCard } from "@/components/section-card";
import { TeacherStudentLessonCreate } from "@/components/teacher-student-lesson-create";
import { TeacherStudentLessons } from "@/components/teacher-student-lessons";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentLessons } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";
import { formatDateTime } from "@/lib/utils";

type TeacherStudentLessonsPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentLessonsPage({ params }: TeacherStudentLessonsPageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;

  const [lessons, bankTopics, settings] = await Promise.all([
    getTeacherStudentLessons(studentId),
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, number: true, difficulty: true }
        }
      }
    }),
    getSiteSettingsUncached()
  ]);

  const aiAvailable = Boolean(settings.aiEnabled && settings.lessonPlanEnabled && getAiCheckConfig(settings));

  return (
    <SectionCard
      title="Занятия и итоги"
      description="Соберите новое занятие ИИ или вручную, отмечайте итоги светофором и правьте наборы прошлых уроков."
    >
      <div className="mb-5">
        <TeacherStudentLessonCreate studentId={studentId} prefix="/teacher" aiAvailable={aiAvailable} />
      </div>

      <TeacherStudentLessons
        studentId={studentId}
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          participantId: lesson.participantId,
          title: lesson.title,
          status: lesson.status,
          createdAtLabel: formatDateTime(lesson.createdAt),
          durationMinutes: lesson.durationMinutes,
          groupName: lesson.groupName,
          planPending: lesson.planPending,
          planError: lesson.planError,
          items: lesson.items
        }))}
        bank={bankTopics.map((topic) => ({
          topicId: topic.id,
          topicTitle: topic.title,
          numbers: topic.homeworkNumbers
        }))}
      />
    </SectionCard>
  );
}
