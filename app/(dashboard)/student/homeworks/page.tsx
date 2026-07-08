import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentHomeworkSubmissions } from "@/components/student-homework-submissions";
import { requireUser } from "@/lib/auth";
import { getStudentHomeworks } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

export default async function StudentHomeworksPage() {
  const user = await requireUser(UserRole.STUDENT);
  const { assignmentsEnabled, assignments } = await getStudentHomeworks(user.id);

  return (
    <div className="min-h-[70vh]">
      <ShbzPageHeader kicker="Домашние задания" title="Мои ДЗ" aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />} />

      {!assignmentsEnabled ? (
        <div className="ui-notice-warning rounded-[12px] px-4 py-3 text-sm">
          Раздел ДЗ появится после обновления базы данных до актуальной версии.
        </div>
      ) : assignments.length === 0 ? (
        <div className="ui-panel-soft rounded-[28px] border-dashed px-5 py-10 text-center">
          <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">ДЗ пока не выдано</p>
          <p className="ui-copy-muted mt-2 text-sm">Когда учитель выдаст ДЗ, оно появится здесь.</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Прикрепите фото решённого ДЗ — учитель увидит их при проверке.
          </p>
          <StudentHomeworkSubmissions
            assignments={assignments.map((assignment) => ({
              id: assignment.id,
              label: assignment.label,
              topicId: assignment.topicId,
              topicTitle: assignment.topicTitle,
              deadlineAt: toIsoDateTimeString(assignment.deadlineAt),
              totalNumbers: assignment.totalNumbers,
              solvedCount: assignment.solvedCount,
              solvedPercent: assignment.solvedPercent,
              photosCount: assignment.photos.length,
              numbers: assignment.numbers.map((number) => ({
                homeworkNumberId: number.homeworkNumberId,
                number: number.number,
                status: number.status
              }))
            }))}
          />
        </>
      )}
    </div>
  );
}
