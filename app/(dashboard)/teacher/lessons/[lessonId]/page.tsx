import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
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
    getLessonDetail(lessonId),
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
        kicker={`${lesson.group?.name ?? "Урок"} · ${formatDateTime(lesson.createdAt)} · ${lesson.durationMinutes} мин`}
        title={lesson.title}
      />

      <TeacherLessonBoard
        prefix={prefix}
        aiAvailable={aiAvailable}
        lesson={{
          id: lesson.id,
          participants: lesson.participants.map((participant) => ({
            id: participant.id,
            studentId: participant.studentId,
            studentName: participant.studentName,
            speed: participant.speed,
            planSummary: participant.planSummary,
            planGeneratedAt: participant.planGeneratedAt ? participant.planGeneratedAt.toISOString() : null,
            planError: participant.planError,
            createdAt: participant.createdAt.toISOString(),
            items: participant.items.map((item) => ({
              id: item.id,
              homeworkNumberId: item.homeworkNumberId,
              number: item.number,
              difficulty: item.difficulty,
              reason: item.reason,
              minutes: item.minutes,
              comment: item.comment,
              isExtra: item.isExtra,
              topicTitle: item.topicTitle,
              studentStatus: item.studentStatus
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
