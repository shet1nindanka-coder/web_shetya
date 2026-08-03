import { UserRole } from "@prisma/client";
import { SectionCard } from "@/components/section-card";
import { TeacherStudentLessons } from "@/components/teacher-student-lessons";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentLessons } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

type TeacherStudentLessonsPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentLessonsPage({ params }: TeacherStudentLessonsPageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;

  const [lessons, bankTopics] = await Promise.all([
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
    })
  ]);

  return (
    <SectionCard
      title="Занятия и итоги"
      description="Проведённые и запланированные занятия ученика. Отмечайте итоги светофором, правьте наборы и пересобирайте подбор."
    >
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
