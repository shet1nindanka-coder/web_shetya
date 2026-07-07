import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { logInfoEvent } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isMissingHomeworkAssignmentTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    error.message.includes("HomeworkAssignment")
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

function revalidateHomeworkRoutes(studentId: string, topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/student/topics");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
  revalidatePath(`/teacher/students/${studentId}/assign`);
  revalidatePath(`/teacher/students/${studentId}/homeworks`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:teacher-homeworks", user.id, 120, 60_000);

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

  const studentId = String(body?.studentId ?? "").trim();
  const topicId = String(body?.topicId ?? "").trim();
  const homeworkNumberIds = Array.from(
    new Set(
      (Array.isArray(body?.homeworkNumberIds) ? body.homeworkNumberIds : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
  const deadlineAt =
    typeof body?.deadlineAt === "string" && body.deadlineAt.trim() ? new Date(body.deadlineAt) : null;

  if (!studentId || !topicId || !homeworkNumberIds.length || !deadlineAt || Number.isNaN(deadlineAt.getTime())) {
    return NextResponse.json({ error: "Некорректные данные для ДЗ." }, { status: 400 });
  }

  const [student, foundNumbers] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: studentId,
        role: UserRole.STUDENT
      },
      select: { id: true }
    }),
    prisma.topicHomeworkNumber.findMany({
      where: {
        id: {
          in: homeworkNumberIds
        },
        topicId
      },
      select: {
        id: true,
        number: true
      }
    })
  ]);

  if (!student || foundNumbers.length !== homeworkNumberIds.length) {
    return NextResponse.json({ error: "Ученик или номер задания не найден." }, { status: 404 });
  }

  let assignmentId: string;

  try {
    const [assignment] = await prisma.$transaction([
      prisma.homeworkAssignment.create({
        data: {
          studentId,
          topicId,
          title: title || null,
          deadlineAt,
          numbers: {
            create: homeworkNumberIds.map((homeworkNumberId) => ({ homeworkNumberId }))
          }
        },
        select: { id: true }
      }),
      ...homeworkNumberIds.map((homeworkNumberId) =>
        prisma.studentTopicNumberStatus.upsert({
          where: {
            studentId_homeworkNumberId: {
              studentId,
              homeworkNumberId
            }
          },
          update: {
            deadlineAt
          },
          create: {
            studentId,
            homeworkNumberId,
            status: null,
            deadlineAt
          }
        })
      )
    ]);

    assignmentId = assignment.id;
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      return NextResponse.json(
        { error: "Таблица ДЗ ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    if (isMissingStudentDeadlineColumnError(error)) {
      return NextResponse.json(
        {
          error: "Колонка deadlineAt ещё не добавлена в PostgreSQL. Сначала примените миграцию.",
          deadlinesEnabled: false
        },
        { status: 503 }
      );
    }

    throw error;
  }

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { title: true } });
  const numbersLabel = foundNumbers
    .map((entry) => entry.number)
    .sort((left, right) => left - right)
    .join(", ");
  const deadlineLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  }).format(deadlineAt);

  await createNotification({
    userId: studentId,
    type: "homework-assigned",
    title: `Учитель выдал ДЗ по теме «${topic?.title ?? "Тема"}»`,
    body: `${homeworkNumberIds.length > 1 ? "Номера" : "Номер"} ${numbersLabel} · дедлайн ${deadlineLabel}`,
    href: `/student/topics/${topicId}`
  });

  revalidateHomeworkRoutes(studentId, topicId);
  publishDashboardRealtimeEvent({
    kind: "student-deadlines-changed",
    studentId,
    topicId
  });
  logInfoEvent("homework.assign.succeeded", {
    studentId,
    topicId,
    assignmentId,
    numbersCount: homeworkNumberIds.length
  });

  return NextResponse.json({
    ok: true,
    assignmentId,
    deadlineAt: deadlineAt.toISOString(),
    homeworkNumberIds
  });
}

export async function DELETE(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:teacher-homeworks", user.id, 120, 60_000);

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
