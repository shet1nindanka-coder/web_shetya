import { ParentCallOutcome, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { jsonResponse } from "@/lib/api-json";
import { getRequestLogContext, logErrorEvent, logInfoEvent } from "@/lib/logger";
import {
  canAccessStudentParentCalls,
  markParentCallNotificationsRead
} from "@/lib/parent-calls";
import { prisma } from "@/lib/prisma";
import { normalizeMultilineText } from "@/lib/utils";

export const runtime = "nodejs";

/*
 * Звонки родителям. Доступ: учитель — только свои ученики, DEVELOPER — все,
 * остальные роли — 401. Комментарий — персональные данные: в логи не пишется
 * (логируются только идентификаторы), ученику не отдаётся нигде.
 */

const MAX_COMMENT_LENGTH = 4000;

function revalidateCallRoutes() {
  // /developer/calls — rewrite-алиас этого же маршрута, отдельная инвалидация
  // ему не нужна (реальный файловый маршрут один).
  revalidatePath("/teacher/calls");
  revalidatePath("/teacher");
}

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = (searchParams.get("studentId") ?? "").trim();

  if (!studentId) {
    return NextResponse.json({ error: "Укажите ученика." }, { status: 400 });
  }

  const access = await canAccessStudentParentCalls(user, studentId);

  if (!access.allowed || !access.student) {
    // Не раскрываем чужому учителю, существует ли ученик.
    return NextResponse.json({ error: "Ученик не найден." }, { status: 404 });
  }

  const calls = await prisma.parentCallLog.findMany({
    where: { studentId },
    orderBy: [{ calledAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      outcome: true,
      comment: true,
      calledAt: true,
      teacher: { select: { name: true } }
    }
  });

  return jsonResponse(request, {
    studentId,
    calls: calls.map((call) => ({
      id: call.id,
      outcome: call.outcome,
      comment: call.comment,
      calledAt: call.calledAt.toISOString(),
      teacherName: call.teacher?.name ?? null
    }))
  });
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:parent-calls", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        studentId?: string;
        outcome?: string;
        comment?: string;
      }
    | null;

  const studentId = String(body?.studentId ?? "").trim();
  const outcomeRaw = String(body?.outcome ?? "").trim();
  const comment = normalizeMultilineText(String(body?.comment ?? "")).slice(0, MAX_COMMENT_LENGTH);

  if (!studentId) {
    return NextResponse.json({ error: "Укажите ученика." }, { status: 400 });
  }

  if (outcomeRaw !== ParentCallOutcome.REACHED && outcomeRaw !== ParentCallOutcome.NO_ANSWER) {
    return NextResponse.json({ error: "Укажите исход звонка." }, { status: 400 });
  }

  const outcome = outcomeRaw as ParentCallOutcome;
  const access = await canAccessStudentParentCalls(user, studentId);

  if (!access.allowed || !access.student) {
    return NextResponse.json({ error: "Ученик не найден." }, { status: 404 });
  }

  try {
    const call = await prisma.parentCallLog.create({
      data: {
        studentId,
        teacherId: user.id,
        outcome,
        comment: comment || null
      },
      select: { id: true, outcome: true, comment: true, calledAt: true }
    });

    if (outcome === ParentCallOutcome.REACHED) {
      await markParentCallNotificationsRead(user.id, studentId);
    }

    revalidateCallRoutes();

    // Комментарий в лог не попадает — только идентификаторы и исход.
    logInfoEvent(
      "teacher.parent_call.recorded",
      { ...requestContext, userId: user.id, studentId, callId: call.id, outcome },
      "Parent call recorded."
    );

    return NextResponse.json({
      call: {
        id: call.id,
        outcome: call.outcome,
        comment: call.comment,
        calledAt: call.calledAt.toISOString(),
        teacherName: user.name
      }
    });
  } catch (error) {
    logErrorEvent(
      "teacher.parent_call.record.failed",
      { ...requestContext, userId: user.id, studentId },
      error,
      "Failed to record parent call."
    );

    return NextResponse.json({ error: "Не удалось сохранить звонок." }, { status: 500 });
  }
}
