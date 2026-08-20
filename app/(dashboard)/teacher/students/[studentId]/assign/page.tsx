import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { SectionCard } from "@/components/section-card";
import { TeacherHomeworkAssignBoard } from "@/components/teacher-homework-assign-board";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { toIsoDateTimeString } from "@/lib/utils";

type TeacherStudentAssignPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentAssignPage({ params }: TeacherStudentAssignPageProps) {
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

  // Условия задач для карточек выбора; .catch — колонки может не быть до миграции.
  const conditions = await prisma.topicHomeworkNumber
    .findMany({ select: { id: true, conditionLatex: true } })
    .catch(() => [] as Array<{ id: string; conditionLatex: string | null }>);
  const conditionById = new Map(conditions.map((entry) => [entry.id, entry.conditionLatex]));

  return (
    <SectionCard title="Выдать домашнее задание">
      {!data.deadlinesEnabled ? (
        <div className="ui-notice-warning rounded-[12px] px-4 py-3 text-sm">
          Выдача ДЗ появится здесь после обновления базы данных до актуальной версии.
        </div>
      ) : data.topics.length === 0 ? (
        <div className="ui-panel-soft rounded-[16px] border-dashed px-5 py-10 text-center">
          <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Темы пока не добавлены</p>
        </div>
      ) : (
        <TeacherHomeworkAssignBoard
          studentId={data.student.id}
          topics={data.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            totalNumbers: topic.totalNumbers,
            numbers: topic.numbers.map((number) => ({
              id: number.id,
              number: number.number,
              status: number.studentStatus?.status ?? null,
              deadlineAt: toIsoDateTimeString(number.studentStatus?.deadlineAt ?? null),
              conditionLatex: conditionById.get(number.id) ?? null
            }))
          }))}
        />
      )}
    </SectionCard>
  );
}
