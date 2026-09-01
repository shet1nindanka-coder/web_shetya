import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherLessonBoard } from "@/components/teacher-lesson-board";
import { requireUser } from "@/lib/auth";
import { getLessonDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LessonDetailPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function LessonDetailPage({ params }: LessonDetailPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const { lessonId } = await params;

  const [lesson, settings, bankTopics] = await Promise.all([
    getLessonDetail(user, lessonId),
    getSiteSettingsUncached(),
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: { id: true, number: true, difficulty: true }
        }
      }
    })
  ]);

  if (!lesson) {
    notFound();
  }

  const aiAvailable = Boolean(settings.aiEnabled && settings.lessonPlanEnabled && getAiCheckConfig(settings));

  return (
    <div>
      <ShbzPageHeader
        kicker={`${lesson.group?.name ?? "Урок"} · ${formatDateTime(lesson.startsAt ?? lesson.createdAt)} · ${lesson.durationMinutes} мин`}
        title={lesson.title}
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      <TeacherLessonBoard
        prefix={prefix}
        aiAvailable={aiAvailable}
        idleWarnMinutes={settings.lessonIdleWarnMinutes}
        idleAlertMinutes={settings.lessonIdleAlertMinutes}
        lesson={{
          id: lesson.id,
          status: lesson.status,
          startsAt: lesson.startsAt ? lesson.startsAt.toISOString() : null,
          participants: lesson.participants.map((participant) => ({
            id: participant.id,
            studentId: participant.studentId,
            studentName: participant.studentName,
            speed: participant.speed,
            planSummary: participant.planSummary,
            planGeneratedAt: participant.planGeneratedAt ? participant.planGeneratedAt.toISOString() : null,
            planError: participant.planError,
            createdAt: participant.createdAt.toISOString(),
            joinedAt: participant.joinedAt ? participant.joinedAt.toISOString() : null,
            items: participant.items.map((item) => ({
              id: item.id,
              homeworkNumberId: item.homeworkNumberId,
              number: item.number,
              difficulty: item.difficulty,
              reason: item.reason,
              minutes: item.minutes,
              comment: item.comment,
              isExtra: item.isExtra,
              result: item.result,
              topicTitle: item.topicTitle,
              studentStatus: item.studentStatus,
              submission: item.latestSubmission
                ? {
                    status: item.latestSubmission.status,
                    verdict: item.latestSubmission.verdict,
                    submittedAt: item.latestSubmission.submittedAt.toISOString(),
                    checkedAt: item.latestSubmission.checkedAt ? item.latestSubmission.checkedAt.toISOString() : null,
                    photoFileIds: item.latestSubmission.photos.map((photo) => photo.fileId)
                  }
                : null
            }))
          }))
        }}
        bank={bankTopics.map((topic) => ({
          topicId: topic.id,
          topicTitle: topic.title,
          numbers: topic.homeworkNumbers
        }))}
      />
    </div>
  );
}
