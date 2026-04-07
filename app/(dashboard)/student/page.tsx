import Link from "next/link";
import { UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { UpcomingDeadlinesCard } from "@/components/upcoming-deadlines-card";
import { requireUser } from "@/lib/auth";
import { getStudentDeadlines } from "@/lib/platform-data";
import { groupStudentDeadlinesAsAssignments } from "@/lib/student-deadline-groups";
import { formatDate } from "@/lib/utils";

export default async function StudentPage() {
  const user = await requireUser(UserRole.STUDENT);
  const deadlines = await getStudentDeadlines(user.id);
  const assignmentDeadlines = groupStudentDeadlinesAsAssignments(deadlines);
  const pendingAssignments = assignmentDeadlines.filter((assignment) => assignment.status !== "DONE");
  const completedAssignments = assignmentDeadlines.filter((assignment) => assignment.status === "DONE");
  const totalHomeworkNumbers = assignmentDeadlines.reduce((sum, assignment) => sum + assignment.totalNumbers, 0);
  const solvedHomeworkNumbers = assignmentDeadlines.reduce((sum, assignment) => sum + assignment.solvedNumbers, 0);
  const homeworkProgressPercent = totalHomeworkNumbers > 0 ? Math.round((solvedHomeworkNumbers / totalHomeworkNumbers) * 100) : 0;
  const nextAssignment = pendingAssignments[0] ?? null;
  const assignmentScopeLabel = assignmentDeadlines.length > 0 ? `${completedAssignments.length} из ${assignmentDeadlines.length} ДЗ закрыто` : "Пока нет выданных ДЗ";
  const continueHomeworkHref = nextAssignment
    ? `/student/topics/${nextAssignment.topicId}?homework=${encodeURIComponent(nextAssignment.deadlineAt)}`
    : "/student/deadlines";

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Обзор"
        title="Ваш кабинет"
        description="Только то, что помогает понять следующий шаг в учебе."
      />

      <UpcomingDeadlinesCard deadlines={assignmentDeadlines} limit={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Ближайшее ДЗ" description="Сейчас важнее всего доделать это задание.">
          <div className="space-y-3">
            {nextAssignment ? (
              <>
                <div className="ui-surface rounded-[14px] border px-3.5 py-3">
                  <p className="font-medium text-[var(--theme-text-strong)]">Текущее домашнее задание</p>
                  <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
                    {nextAssignment.solvedNumbers} из {nextAssignment.totalNumbers} номеров выполнено
                  </p>
                  <p className="mt-1 text-xs text-[var(--theme-text-muted)]">Дедлайн: {formatDate(nextAssignment.deadlineAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={continueHomeworkHref}
                    className="ui-pressable ui-button-primary inline-flex rounded-[10px] px-3.5 py-2 text-sm font-semibold"
                  >
                    Продолжить ДЗ
                  </Link>
                  <Link
                    href={continueHomeworkHref}
                    className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3.5 py-2 text-sm font-semibold"
                  >
                    Перейти к номерам
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-[var(--theme-text-muted)]">Сейчас нет выданных домашних заданий.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Прогресс по выданным ДЗ" description="Ориентир только по текущим домашним заданиям.">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-[var(--theme-text-muted)]">
              <span>{assignmentScopeLabel}</span>
              <span className="font-semibold text-[var(--theme-text-strong)]">
                {solvedHomeworkNumbers} / {totalHomeworkNumbers}
              </span>
            </div>
            <ProgressBar value={homeworkProgressPercent} size="md" />
            <div className="flex flex-wrap gap-2">
              <Link
                href="/student/deadlines"
                className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3 py-2 text-sm font-semibold"
              >
                Открыть все ДЗ
              </Link>
              <Link
                href="/student/info"
                className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-3 py-2 text-sm font-semibold"
              >
                Общая инфа
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
