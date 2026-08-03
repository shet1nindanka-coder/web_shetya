import { LessonKind, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { normalizeHomeworkParams } from "@/lib/homework-plan";
import { MAX_GROUP_SIZE } from "@/lib/lesson-plan";
import { LessonPlanUnavailableError, resolvePlannerGate } from "@/lib/lesson-plan-generate";
import { enqueueLessonPlan } from "@/lib/lesson-plan-queue";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

function revalidatePlanRoutes(planId?: string) {
  revalidateTeacherStudentsData();
  revalidatePath("/teacher/homework-plans");

  if (planId) {
    revalidatePath(`/teacher/homework-plans/${planId}`);
  }
}

/** Создать черновик ИИ-ДЗ и запустить подбор. */
export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:homework-plan", user.id, 10, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        topicId?: string;
        deadlineAt?: string;
        title?: string;
        teacherNote?: string;
        sourceLessonId?: string;
        dailyMinutes?: number;
        groupId?: string;
        studentIds?: string[];
      }
    | null;

  const params = normalizeHomeworkParams(body, new Date());

  if (!params) {
    return NextResponse.json(
      { error: "Укажите тему и дедлайн в будущем (дату следующего занятия)." },
      { status: 400 }
    );
  }

  const topic = await prisma.topic.findUnique({
    where: { id: params.topicId },
    select: { id: true, title: true, subject: true }
  });

  if (!topic) {
    return NextResponse.json({ error: "Тема не найдена." }, { status: 404 });
  }

  const requestedIds = Array.isArray(body?.studentIds)
    ? body.studentIds.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const groupId = String(body?.groupId ?? "").trim();
  let studentIds: string[] = [];
  let resolvedGroupId: string | null = null;

  if (groupId) {
    const group = await prisma.studentGroup.findFirst({
      where: {
        id: groupId,
        ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
      },
      select: { id: true, members: { select: { userId: true } } }
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена." }, { status: 404 });
    }

    const memberIds = new Set(group.members.map((member) => member.userId));
    studentIds = requestedIds.length > 0 ? requestedIds.filter((id) => memberIds.has(id)) : Array.from(memberIds);
    resolvedGroupId = group.id;
  } else {
    const students = await prisma.user.findMany({
      where: { role: UserRole.STUDENT, id: { in: requestedIds } },
      select: { id: true }
    });
    studentIds = students.map((student) => student.id);
  }

  if (studentIds.length === 0) {
    return NextResponse.json({ error: "Выберите хотя бы одного ученика." }, { status: 400 });
  }

  if (studentIds.length > MAX_GROUP_SIZE) {
    return NextResponse.json({ error: `Не больше ${MAX_GROUP_SIZE} учеников за раз.` }, { status: 400 });
  }

  const title = params.title || `ДЗ по теме «${topic.title}» до ${formatDate(params.deadlineAt)}`;

  try {
    const plan = await prisma.lesson.create({
      data: {
        kind: LessonKind.HOMEWORK,
        title,
        subject: topic.subject,
        teacherId: user.id,
        groupId: resolvedGroupId,
        topicId: topic.id,
        deadlineAt: params.deadlineAt,
        planParams: {
          title,
          topicId: topic.id,
          deadlineAt: params.deadlineAt.toISOString(),
          teacherNote: params.teacherNote,
          sourceLessonId: params.sourceLessonId,
          dailyMinutes: params.dailyMinutes
        },
        participants: {
          create: studentIds.map((studentId) => ({ studentId }))
        }
      },
      select: { id: true, participants: { select: { id: true } } }
    });

    logInfoEvent("homework_plan.created", {
      ...requestContext,
      userId: user.id,
      planId: plan.id,
      participants: plan.participants.length,
      sourceLessonId: params.sourceLessonId
    });
    revalidatePlanRoutes(plan.id);

    const settings = await getSiteSettingsUncached();

    if (!settings.homeworkPlanEnabled || !resolvePlannerGate(settings)) {
      return NextResponse.json(
        { error: new LessonPlanUnavailableError().message, planId: plan.id },
        { status: 503 }
      );
    }

    enqueueLessonPlan(
      plan.id,
      plan.participants.map((participant) => participant.id),
      "HOMEWORK"
    );

    return NextResponse.json({ ok: true, planId: plan.id });
  } catch (error) {
    logErrorEvent(
      "homework_plan.create_failed",
      { ...requestContext, userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to create homework plan."
    );

    return NextResponse.json(
      { error: "Не удалось создать черновик ДЗ. Применена ли миграция homework plans?" },
      { status: 500 }
    );
  }
}
