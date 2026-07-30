import { UserRole } from "@prisma/client";
import { SectionCard } from "@/components/section-card";
import { TeacherStudentLessons } from "@/components/teacher-student-lessons";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentLessons } from "@/lib/platform-data";
import { formatDateTime } from "@/lib/utils";

type TeacherStudentLessonsPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentLessonsPage({ params }: TeacherStudentLessonsPageProps) {
  await requireUser(UserRole.TEACHER);
  const { studentId } = await params;
  const lessons = await getTeacherStudentLessons(studentId);

  return (
    <SectionCard
      title="Занятия и итоги"
      description="Наборы задач с уроков этого ученика. Отмечайте итоги светофором прямо здесь: решил — зелёный, с ошибками — жёлтый, не решил — красный (номер вернётся в подбор)."
    >
      <TeacherStudentLessons
        lessons={lessons.map((lesson) => ({
          id: lesson.id,
          participantId: lesson.participantId,
          title: lesson.title,
          status: lesson.status,
          createdAtLabel: formatDateTime(lesson.createdAt),
          durationMinutes: lesson.durationMinutes,
          groupName: lesson.groupName,
          items: lesson.items
        }))}
      />
    </SectionCard>
  );
}
