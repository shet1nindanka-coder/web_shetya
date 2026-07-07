import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { DeleteStudentDialog } from "@/components/delete-student-dialog";
import { TeacherStudentProgressBoard } from "@/components/teacher-student-progress-board";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type TeacherStudentPageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentPage({ params }: TeacherStudentPageProps) {
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

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/teacher/students"
        backLabel="← Ко всем ученикам"
        eyebrow="Ученик"
        title={data.student.name}
        description={data.student.email}
        actions={
          <>
            <a
              href={`/teacher/students/${data.student.id}/export`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            >
              Экспорт прогресса Excel
            </a>
            <a
              href={`/teacher/students/${data.student.id}/export?period=week`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            >
              Что сделано за 7 дней
            </a>
            <DeleteStudentDialog
              studentId={data.student.id}
              studentName={data.student.name}
              triggerLabel="Удалить ученика"
            />
          </>
        }
      />

      <SectionCard title="Темы ученика">
        {!data.notesEnabled ? (
          <div className="ui-notice-warning rounded-[12px] px-4 py-3 text-sm">
            Заметки ученика появятся здесь после обновления базы данных до актуальной версии.
          </div>
        ) : null}
        {data.topics.length === 0 ? (
          <div className="ui-panel-soft rounded-[28px] border-dashed px-5 py-10 text-center">
            <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Темы пока не добавлены</p>
          </div>
        ) : (
          <TeacherStudentProgressBoard
            studentId={data.student.id}
            notesEnabled={data.notesEnabled}
            deadlinesEnabled={data.deadlinesEnabled}
            initialTopics={data.topics.map((topic) => ({
              id: topic.id,
              title: topic.title,
              description: topic.description,
              totalNumbers: topic.totalNumbers,
              solvedCount: topic.solvedCount,
              solvedPercent: topic.solvedPercent,
              markedCount: topic.markedCount,
              redCount: topic.redCount,
              numbers: topic.numbers.map((number) => ({
                id: number.id,
                number: number.number,
                studentStatus: number.studentStatus
                  ? {
                      status: number.studentStatus.status,
                      note: number.studentStatus.note,
                      deadlineAt: toIsoDateTimeString(number.studentStatus.deadlineAt ?? null)
                    }
                  : null
              }))
            }))}
          />
        )}
      </SectionCard>
    </div>
  );
}
