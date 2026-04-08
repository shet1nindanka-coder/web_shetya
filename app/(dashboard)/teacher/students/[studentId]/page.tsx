import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { DeleteStudentDialog } from "@/components/delete-student-dialog";
import { TeacherStudentProgressBoard } from "@/components/teacher-student-progress-board";
import { requireUser } from "@/lib/auth";
import { getTeacherStudentDetail } from "@/lib/platform-data";
import { formatDate, toIsoDateTimeString } from "@/lib/utils";

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
        metrics={[
          { label: "Темы", value: data.stats.totalTopics },
          { label: "Решено", value: `${data.stats.totalSolved} / ${data.stats.totalNumbers}` },
          { label: "Отмечено", value: `${data.stats.totalMarked} / ${data.stats.totalNumbers}` }
        ]}
        aside={
          <div className="ui-page-header-aside">
            <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
              <p className="ui-kicker">Ученик в системе</p>
              <p className="mt-2 text-sm font-semibold text-[var(--theme-text-strong)]">{formatDate(data.student.createdAt)}</p>
            </div>
            <a
              href={`/teacher/students/${data.student.id}/export`}
              className="ui-pressable ui-button-secondary inline-flex justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition"
            >
              Экспорт прогресса Excel
            </a>
            <DeleteStudentDialog
              studentId={data.student.id}
              studentName={data.student.name}
              triggerLabel="Удалить ученика"
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Темы" value={data.stats.totalTopics} />
        <StatCard label="Решено" value={`${data.stats.solvedPercent}%`} />
        <StatCard label="Желтые" value={data.stats.totalYellow} />
        <StatCard label="Красные" value={data.stats.totalRed} />
      </div>

      <SectionCard title="Общая картина" description="Решено учитывает только зелёные и жёлтые номера.">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="ui-panel-soft space-y-3 rounded-[24px] p-5">
            <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
              <span>Решено номеров</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {data.stats.totalSolved} / {data.stats.totalNumbers}
              </span>
            </div>
            <ProgressBar value={data.stats.solvedPercent} size="md" />
          </div>
          <div className="ui-panel-soft space-y-3 rounded-[24px] p-5">
            <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
              <span>Отмечено статусов</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {data.stats.totalMarked} / {data.stats.totalNumbers}
              </span>
            </div>
            <ProgressBar value={data.stats.markedPercent} size="md" />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Темы ученика">
        {!data.notesEnabled ? (
          <div className="ui-notice-warning rounded-[24px] px-4 py-3 text-sm">
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
