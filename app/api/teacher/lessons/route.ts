import { AssignmentReason, type Subject, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { MAX_GROUP_SIZE, normalizePlanParams, normalizeSpeed } from "@/lib/lesson-plan";
import { LessonPlanUnavailableError } from "@/lib/lesson-plan-generate";
import { enqueueLessonPlan } from "@/lib/lesson-plan-queue";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import { revalidateTeacherStudentsData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

function revalidateLessonRoutes(lessonId?: string) {
  revalidateTeacherStudentsData();
  revalidatePath("/teacher/groups");
  revalidatePath("/teacher/lessons");

  if (lessonId) {
    revalidatePath(`/teacher/lessons/${lessonId}`);
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:lesson-plan", user.id, 10, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        groupId?: string;
        studentIds?: string[];
        title?: string;
        durationMinutes?: number;
        topicIds?: string[];
        targetDifficulty?: number | null;
        teacherNote?: string;
        /** Дата и время начала урока — от них считается статус (запланирован/идёт/завершён). */
        startsAt?: string;
        /** Собрать урок вручную: не звать ИИ-подбор. */
        skipPlan?: boolean;
        /** Номера, выбранные учителем руками (только вместе со skipPlan). */
        numberIds?: string[];
      }
    | null;

  const groupId = String(body?.groupId ?? "").trim();
  const requestedIds = Array.isArray(body?.studentIds)
    ? body.studentIds.map((value) => String(value).trim()).filter(Boolean)
    : [];
  let studentIds: string[] = [];
  let resolvedGroup: { id: string; subject: Subject } | null = null;

  if (groupId) {
    const group = await prisma.studentGroup.findFirst({
      where: {
        id: groupId,
        ...(user.role === UserRole.DEVELOPER ? {} : { teacherId: user.id })
      },
      select: {
        id: true,
        subject: true,
        members: { select: { userId: true } }
      }
    });

    if (!group) {
      return NextResponse.json({ error: "Группа не найдена." }, { status: 404 });
    }

    const memberIds = new Set(group.members.map((member) => member.userId));

    studentIds = requestedIds.length > 0 ? requestedIds.filter((id) => memberIds.has(id)) : Array.from(memberIds);
    resolvedGroup = { id: group.id, subject: group.subject };
  } else {
    // Индивидуальный урок без группы: как в планах ДЗ — проверяем только, что это ученики.
    const students = await prisma.user.findMany({
      // Только свои ученики (SEC-003); DEVELOPER может собрать урок любому.
      where: {
        role: UserRole.STUDENT,
        id: { in: requestedIds },
        ...(user.role === UserRole.TEACHER ? { teacherId: user.id } : {})
      },
      select: { id: true }
    });

    studentIds = students.map((student) => student.id);
  }

  if (studentIds.length === 0) {
    return NextResponse.json({ error: "Выберите хотя бы одного ученика." }, { status: 400 });
  }

  if (studentIds.length > MAX_GROUP_SIZE) {
    return NextResponse.json({ error: `Не больше ${MAX_GROUP_SIZE} учеников за один урок.` }, { status: 400 });
  }

  const params = normalizePlanParams({
    title: body?.title,
    durationMinutes: body?.durationMinutes,
    topicIds: body?.topicIds,
    targetDifficulty: body?.targetDifficulty,
    teacherNote: body?.teacherNote
  });
  const title = params.title || `Занятие от ${formatDate(new Date())}`;

  // Дата и время урока: необязательны; при наличии от них считается статус.
  const startsAtRaw = String(body?.startsAt ?? "").trim();
  let startsAt: Date | null = null;

  if (startsAtRaw) {
    const parsed = new Date(startsAtRaw);

    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "Некорректные дата и время урока." }, { status: 400 });
    }

    startsAt = parsed;
  }

  // Индивидуальные переопределения скорости приходят вместе со studentIds.
  const speedOverrides = new Map<string, number | null>();

  if (body && typeof body === "object" && "speeds" in body && body.speeds && typeof body.speeds === "object") {
    for (const [studentId, rawSpeed] of Object.entries(body.speeds as Record<string, unknown>)) {
      speedOverrides.set(studentId, normalizeSpeed(rawSpeed));
    }
  }

  let lessonId: string;

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title,
        ...(resolvedGroup ? { subject: resolvedGroup.subject } : {}),
        teacherId: user.id,
        groupId: resolvedGroup?.id ?? null,
        durationMinutes: params.durationMinutes,
        startsAt,
        planParams: {
          title,
          durationMinutes: params.durationMinutes,
          topicIds: params.topicIds,
          targetDifficulty: params.targetDifficulty,
          teacherNote: params.teacherNote
        },
        participants: {
          create: studentIds.map((studentId) => ({
            studentId,
            speed: speedOverrides.get(studentId) ?? null,
            // Ручная сборка: набор «готов» сразу, ИИ-подбора не будет. Без этой
            // отметки доска вечно крутит «ИИ подбирает задания…», а по таймауту
            // врёт про сброшенную рестартом очередь.
            ...(body?.skipPlan === true ? { planGeneratedAt: new Date() } : {})
          }))
        }
      },
      select: { id: true, participants: { select: { id: true } } }
    });

    lessonId = lesson.id;

    // Ручная сборка: номера выбраны на доске, раскладываем их всем участникам
    // в порядке выбора. Существование номеров проверяем — id приходят от клиента.
    const manualNumberIds = Array.isArray(body?.numberIds)
      ? body.numberIds.map((value) => String(value).trim()).filter(Boolean)
      : [];

    if (body?.skipPlan === true && manualNumberIds.length > 0) {
      const existingNumbers = await prisma.topicHomeworkNumber.findMany({
        where: { id: { in: manualNumberIds } },
        select: { id: true }
      });
      const existingIds = new Set(existingNumbers.map((row) => row.id));
      const orderedIds = manualNumberIds.filter((id) => existingIds.has(id));

      if (orderedIds.length > 0) {
        await prisma.lessonAssignmentItem.createMany({
          data: lesson.participants.flatMap((participant) =>
            orderedIds.map((homeworkNumberId, order) => ({
              participantId: participant.id,
              homeworkNumberId,
              order,
              reason: AssignmentReason.NEW,
              isExtra: false
            }))
          )
        });
      }
    }
    logInfoEvent("lesson_plan.lesson_created", {
      ...requestContext,
      userId: user.id,
      lessonId,
      participants: lesson.participants.length
    });

    revalidateLessonRoutes(lessonId);

    // Учитель выбрал «собрать вручную» — урок создан пустым, подбор не запускаем.
    if (body?.skipPlan === true) {
      return NextResponse.json({ ok: true, lessonId, skippedPlan: true });
    }

    // ИИ выключен или не настроен: урок уже создан, честно сообщаем 503 — учитель соберёт вручную.
    const settings = await getSiteSettingsUncached();

    if (!settings.aiEnabled || !settings.lessonPlanEnabled || !getAiCheckConfig(settings)) {
      return NextResponse.json(
        { error: new LessonPlanUnavailableError().message, lessonId },
        { status: 503 }
      );
    }

    enqueueLessonPlan(
      lessonId,
      lesson.participants.map((participant) => participant.id)
    );

    return NextResponse.json({ ok: true, lessonId });
  } catch (error) {
    logErrorEvent(
      "lesson_plan.lesson_create_failed",
      { ...requestContext, userId: user.id },
      error instanceof Error ? error : undefined,
      "Failed to create lesson."
    );

    return NextResponse.json(
      { error: "Не удалось создать урок. Применена ли миграция уроков и групп?" },
      { status: 500 }
    );
  }
}
