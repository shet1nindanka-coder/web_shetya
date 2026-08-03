import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { deleteStudentAction } from "@/actions/student";
import { DeleteButton } from "@/components/delete-button";
import { PageHeader } from "@/components/page-header";
import { TeacherStudentTabs } from "@/components/teacher-student-tabs";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";

type TeacherStudentLayoutProps = {
  children: ReactNode;
  params: Promise<{
    studentId: string;
  }>;
};

export default async function TeacherStudentLayout({ children, params }: TeacherStudentLayoutProps) {
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
    <div className="space-y-6">
      <PageHeader
        backHref="/teacher/students"
        backLabel="← Ко всем ученикам"
        eyebrow="Ученик"
        title={data.student.name}
        description={data.student.email}
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
            <DeleteButton
              label="Удалить ученика"
              title="Удалить ученика?"
              description={
                <>
                  Аккаунт <span className="font-semibold">«{data.student.name}»</span> будет удалён вместе со
                  статусами по номерам и назначенными дедлайнами. Это действие нельзя отменить.
                </>
              }
              action={deleteStudentAction}
              fields={{ studentId: data.student.id }}
            />
          </>
        }
      />

      <TeacherStudentTabs studentId={data.student.id} />

      {children}
    </div>
  );
}
