import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonKind, UserRole } from "@prisma/client";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherHomeworkPlanBoard } from "@/components/teacher-homework-plan-board";
import { requireUser } from "@/lib/auth";
import { daysUntil } from "@/lib/homework-plan";
import { getLessonDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type HomeworkPlanDetailPageProps = {
  params: Promise<{ planId: string }>;
};

export default async function HomeworkPlanDetailPage({ params }: HomeworkPlanDetailPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const { planId } = await params;

  const [plan, settings] = await Promise.all([getLessonDetail(planId), getSiteSettingsUncached()]);

  if (!plan || plan.kind !== LessonKind.HOMEWORK || !plan.topicId) {
    notFound();
  }

  const sourceLessonId = (plan.planParams as { sourceLessonId?: string | null } | null)?.sourceLessonId ?? null;

  const [topic, sourceLesson] = await Promise.all([
    prisma.topic.findUnique({
      where: { id: plan.topicId },
      select: {
        id: true,
        title: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, number: true, difficulty: true }
        }
      }
    }),
    sourceLessonId
      ? prisma.lesson.findUnique({ where: { id: sourceLessonId }, select: { id: true, title: true } })
      : Promise.resolve(null)
  ]);

  if (!topic) {
    notFound();
  }

  const aiAvailable = Boolean(settings.aiEnabled && settings.homeworkPlanEnabled && getAiCheckConfig(settings));
  const deadlineLabel = plan.deadlineAt
    ? `дедлайн ${formatDateTime(plan.deadlineAt)} · до следующего занятия — ${daysUntil(plan.deadlineAt, new Date())} дн.`
    : "без дедлайна";

  return (
    <div>
      <ShbzPageHeader
        kicker={`${topic.title} · ${deadlineLabel}${plan.group ? ` · ${plan.group.name}` : ""}`}
        title={plan.title}
        aside={
          sourceLesson ? (
            <Link href={`${prefix}/lessons/${sourceLesson.id}`} className="shbz-btn-outline inline-block no-underline">
              По итогам занятия «{sourceLesson.title}»
            </Link>
          ) : undefined
        }
      />

      <TeacherHomeworkPlanBoard
        prefix={prefix}
        aiAvailable={aiAvailable}
        plan={{
          id: plan.id,
          topicTitle: topic.title,
          participants: plan.participants.map((participant) => ({
            id: participant.id,
            studentId: participant.studentId,
            studentName: participant.studentName,
            planSummary: participant.planSummary,
            planGeneratedAt: participant.planGeneratedAt ? participant.planGeneratedAt.toISOString() : null,
            planError: participant.planError,
            issuedAssignmentId: participant.issuedAssignmentId,
            issuedAt: participant.issuedAt ? participant.issuedAt.toISOString() : null,
            createdAt: participant.createdAt.toISOString(),
            items: participant.items
              .filter((item) => !item.isExtra)
              .map((item) => ({
                id: item.id,
                homeworkNumberId: item.homeworkNumberId,
                number: item.number,
                difficulty: item.difficulty,
                conditionLatex: item.conditionLatex,
                reason: item.reason,
                minutes: item.minutes,
                comment: item.comment,
                studentStatus: item.studentStatus
              }))
          }))
        }}
        topicNumbers={topic.homeworkNumbers}
      />
    </div>
  );
}
