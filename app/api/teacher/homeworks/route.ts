import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { issueHomework } from "@/lib/homework-issue";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { deleteStoredFileRecordIfUnused } from "@/lib/stored-files";

export const runtime = "nodejs";

function isMissingHomeworkAssignmentTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkAssignment") || error.message.includes("HomeworkCheckPhoto"))
  );
}

function isMissingStudentDeadlineColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes("deadlineAt")
  );
}

function isMissingStudentNoteColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes("note")
  );
}

function revalidateHomeworkRoutes(studentId: string, topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/student/homeworks");
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/teacher/students/${studentId}/assign`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:teacher-homeworks", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        studentId?: string;
        topicId?: string;
        homeworkNumberIds?: string[];
        deadlineAt?: string;
        title?: string;
      }
    | null;

  const deadlineAt =
    typeof body?.deadlineAt === "string" && body.deadlineAt.trim() ? new Date(body.deadlineAt) : null;

  if (!deadlineAt) {
    return NextResponse.json({ error: "Некорректные данные для ДЗ." }, { status: 400 });
  }

  const result = await issueHomework({
    studentId: String(body?.studentId ?? ""),
    topicId: String(body?.topicId ?? ""),
    homeworkNumberIds: Array.isArray(body?.homeworkNumberIds) ? body.homeworkNumberIds : [],
    deadlineAt,
    title: typeof body?.title === "string" ? body.title : null
  });

  if (!result.ok) {
    const status =
      result.code === "invalid" ? 400 : result.code === "not_found" ? 404 : result.code === "conflict" ? 409 : 503;

    return NextResponse.json(
      {
        error: result.message,
        ...(result.reason === "deadlineColumn" ? { deadlinesEnabled: false } : {})
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    assignmentId: result.assignmentId,
    deadlineAt: deadlineAt.toISOString(),
    homeworkNumberIds: result.homeworkNumberIds
  });
}

export async function DELETE(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:teacher-homeworks", user.id, 120, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as { assignmentId?: string } | null;
  const assignmentId = String(body?.assignmentId ?? "").trim();

  if (!assignmentId) {
    return NextResponse.json({ error: "Некорректные данные для отмены ДЗ." }, { status: 400 });
  }

  let assignment: {
    id: string;
    studentId: string;
    topicId: string;
    deadlineAt: Date | null;
    numbers: Array<{ homeworkNumberId: string }>;
    photos: Array<{ fileId: string }>;
    checks: Array<{ photos: Array<{ fileId: string }> }>;
  } | null;

  try {
    assignment = await prisma.homeworkAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        studentId: true,
        topicId: true,
        deadlineAt: true,
        numbers: {
          select: { homeworkNumberId: true }
        },
        photos: {
          select: { fileId: true }
        },
        checks: {
          select: {
            photos: {
              select: { fileId: true }
            }
          }
        }
      }
    });
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return NextResponse.json(
        { error: "Таблица ДЗ ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!assignment) {
    return NextResponse.json({ error: "ДЗ не найдено." }, { status: 404 });
  }

  const numberIds = assignment.numbers.map((entry) => entry.homeworkNumberId);

  try {
    await prisma.$transaction([
      prisma.homeworkAssignment.delete({ where: { id: assignment.id } }),
      ...(assignment.deadlineAt && numberIds.length
        ? [
            prisma.studentTopicNumberStatus.updateMany({
              where: {
                studentId: assignment.studentId,
                homeworkNumberId: { in: numberIds },
                deadlineAt: assignment.deadlineAt
              },
              data: { deadlineAt: null }
            })
          ]
        : []),
      ...(numberIds.length
        ? [
            prisma.studentTopicNumberStatus.deleteMany({
              where: {
                studentId: assignment.studentId,
                homeworkNumberId: { in: numberIds },
                status: null,
                note: null,
                deadlineAt: null
              }
            })
          ]
        : [])
    ]);
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return NextResponse.json(
        { error: "Таблица ДЗ ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    // На неотмигрированной БД колонок note/deadlineAt может не быть — зеркало
    // статусов не почистить, но само ДЗ удаляем, чтобы отмена не падала 500.
    if (isMissingStudentDeadlineColumnError(error) || isMissingStudentNoteColumnError(error)) {
      await prisma.homeworkAssignment.delete({ where: { id: assignment.id } }).catch(() => undefined);
    } else {
      throw error;
    }
  }

  const referencedFileIds = new Set([
    ...assignment.photos.map((photo) => photo.fileId),
    ...assignment.checks.flatMap((check) => check.photos.map((photo) => photo.fileId))
  ]);

  for (const fileId of referencedFileIds) {
    await deleteStoredFileRecordIfUnused(fileId);
  }

  revalidateHomeworkRoutes(assignment.studentId, assignment.topicId);
  publishDashboardRealtimeEvent({
    kind: "student-deadlines-changed",
    studentId: assignment.studentId,
    topicId: assignment.topicId
  });
  logInfoEvent("homework.cancel.succeeded", {
    assignmentId: assignment.id,
    studentId: assignment.studentId
  });

  return NextResponse.json({ ok: true });
}
