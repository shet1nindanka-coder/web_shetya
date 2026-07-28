import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DeleteStudentDialog } from "@/components/delete-student-dialog";
import { PageHeader } from "@/components/page-header";
import { TeacherStudentTabs } from "@/components/teacher-student-tabs";
import { StudentPortraitPanel } from "@/components/student-portrait-panel";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

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

  const portraitProfile = await prisma.studentProfile
    .findUnique({
      where: { userId: studentId },
      select: { aiPortrait: true, portraitUpdatedAt: true }
    })
    .catch(() => null);

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
              Что сделано за 7 дней (PDF)
            </a>
            <DeleteStudentDialog
              studentId={data.student.id}
              studentName={data.student.name}
              triggerLabel="Удалить ученика"
            />
          </>
        }
      />

      <TeacherStudentTabs studentId={data.student.id} />

      <StudentPortraitPanel
        studentId={data.student.id}
        portrait={portraitProfile?.aiPortrait ?? null}
        updatedAtLabel={portraitProfile?.portraitUpdatedAt ? formatDateTime(portraitProfile.portraitUpdatedAt) : null}
      />

      {children}
    </div>
  );
}
