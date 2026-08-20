import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { deleteStudentAction } from "@/actions/student";
import { StudentPasswordResetButton } from "@/components/student-password-reset-button";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { TeacherStudentTabs } from "@/components/teacher-student-tabs";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail, getTeacherStudentHomeworks } from "@/lib/platform-data";

type TeacherStudentLayoutProps = {
  children: ReactNode;
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentLayout({ children, params }: TeacherStudentLayoutProps) {
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

  // Тот же кэшированный запрос читает и вкладка «Проверка ДЗ» — новых запросов нет.
  const homeworks = await getTeacherStudentHomeworks(user, studentId);
  const activeHomeworksCount = homeworks.assignmentsEnabled
    ? homeworks.assignments.filter(
        (assignment) =>
          !(assignment.numbers.length > 0 && assignment.solvedCount === assignment.numbers.length)
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/teacher/students"
        backLabel="← Ко всем ученикам"
        eyebrow="Ученик"
        title={data.student.name}
        description={data.student.email}
        metrics={[
          {
            label: "Отмечено",
            value: `${data.stats.totalMarked} из ${data.stats.totalNumbers} · ${data.stats.markedPercent}%`
          },
          { label: "Зелёные", value: data.stats.totalGreen, tone: "success" },
          { label: "Жёлтые", value: data.stats.totalYellow, tone: "warning" },
          { label: "Красные", value: data.stats.totalRed, tone: "danger" }
        ]}
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
        actions={
          <>
            <a
              href={`/teacher/students/${data.student.id}/export/pdf`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            >
              Отчёт: 7 дней
            </a>
            <a
              href={`/teacher/students/${data.student.id}/export/pdf?period=30d`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            >
              30 дней
            </a>
            <a
              href={`/teacher/students/${data.student.id}/export/pdf?period=year`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            >
              Учебный год
            </a>
            <StudentPasswordResetButton
              studentId={data.student.id}
              studentName={data.student.name}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[8px] px-4 py-2.5 text-sm font-semibold transition"
            />
            <DeleteButton
              label="Удалить ученика"
              title="Удалить ученика?"
              description={
                <>
                  Аккаунт <span className="font-semibold">«{data.student.name}»</span> будет удалён вместе со всеми его
                  ДЗ, фото решений, историей проверок, статусами по номерам и дедлайнами. Это действие нельзя отменить.
                </>
              }
              action={deleteStudentAction}
              fields={{ studentId: data.student.id }}
            />
          </>
        }
      />

      <TeacherStudentTabs studentId={data.student.id} activeHomeworksCount={activeHomeworksCount} />

      {children}
    </div>
  );
}
