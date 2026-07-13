import { HomeworkNumberStatus, Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const allowedStatuses = [
  HomeworkNumberStatus.GREEN,
  HomeworkNumberStatus.YELLOW,
  HomeworkNumberStatus.RED
] as const;

function isMissingStudentStatusColumnError(error: unknown, column: "note" | "deadlineAt") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes(column)
  );
}

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/student/homeworks");
  revalidatePath("/teacher");
  revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:student-status", user.id, 90, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        topicId?: string;
        homeworkNumberId?: string;
        status?: HomeworkNumberStatus | null;
        note?: string | null;
      }
    | null;

  const topicId = String(body?.topicId ?? "").trim();
  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const statusProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "status"));
  const noteProvided = Boolean(body && Object.prototype.hasOwnProperty.call(body, "note"));
  const status = body?.status;
  const note = noteProvided ? String(body?.note ?? "").trim().slice(0, 240) : undefined;

  if (statusProvided) {
    return NextResponse.json(
      { error: "Статус выставляется автоматической проверкой или учителем." },
      { status: 403 }
    );
  }

  if (!topicId || !homeworkNumberId || !noteProvided) {
    return NextResponse.json({ error: "Некорректные данные для сохранения номера." }, { status: 400 });
  }

  const homeworkNumber = await prisma.topicHomeworkNumber.findFirst({
    where: {
      id: homeworkNumberId,
      topicId
    },
    select: {
      id: true
    }
  });

  if (!homeworkNumber) {
    return NextResponse.json({ error: "Номер задания для этой темы не найден." }, { status: 404 });
  }

  let notesEnabled: boolean = noteProvided;
  let deadlinesEnabled = true;
  let existingStatus:
    | {
        id: string;
        status: HomeworkNumberStatus | null;
        note?: string | null;
        deadlineAt?: Date | null;
      }
    | null;

  if (noteProvided) {
    try {
      existingStatus = await prisma.studentTopicNumberStatus.findUnique({
        where: {
          studentId_homeworkNumberId: {
            studentId: user.id,
            homeworkNumberId
          }
        },
        select: {
          id: true,
          status: true,
          note: true,
          deadlineAt: true
        }
      });
    } catch (error) {
      if (
        !isMissingStudentStatusColumnError(error, "note") &&
        !isMissingStudentStatusColumnError(error, "deadlineAt")
      ) {
        throw error;
      }

      notesEnabled = !isMissingStudentStatusColumnError(error, "note");
      deadlinesEnabled = !isMissingStudentStatusColumnError(error, "deadlineAt");

      existingStatus = await prisma.studentTopicNumberStatus.findUnique({
        where: {
          studentId_homeworkNumberId: {
            studentId: user.id,
            homeworkNumberId
          }
        },
        select: {
          id: true,
          status: true,
          ...(notesEnabled ? { note: true } : {}),
          ...(deadlinesEnabled ? { deadlineAt: true } : {})
        }
      });
    }
  } else {
    try {
      existingStatus = await prisma.studentTopicNumberStatus.findUnique({
        where: {
          studentId_homeworkNumberId: {
            studentId: user.id,
            homeworkNumberId
          }
        },
        select: {
          id: true,
          status: true,
          deadlineAt: true
        }
      });
    } catch (error) {
      if (!isMissingStudentStatusColumnError(error, "deadlineAt")) {
        throw error;
      }

      deadlinesEnabled = false;
      existingStatus = await prisma.studentTopicNumberStatus.findUnique({
        where: {
          studentId_homeworkNumberId: {
            studentId: user.id,
            homeworkNumberId
          }
        },
        select: {
          id: true,
          status: true
        }
      });
    }
  }

  const nextStatus = statusProvided ? status ?? null : existingStatus?.status ?? null;
  const nextNote = notesEnabled
    ? noteProvided
      ? note || null
      : existingStatus?.note ?? null
    : null;

  if (!notesEnabled && noteProvided && !statusProvided) {
    revalidateTopicRoutes(topicId);
    return NextResponse.json({
      ok: true,
      status: nextStatus,
      note: "",
      notesEnabled: false
    });
  }

  // Заметку правит только ученик. Статус и дедлайн трогать нельзя — их ставят
  // автопроверка и учитель. Поэтому пишем ИСКЛЮЧИТЕЛЬНО поле note: иначе запись
  // заметки затёрла бы статус/дедлайн, выставленный параллельно (по устаревшему
  // снимку existingStatus), нарушая главный инвариант проекта.
  if (nextNote === null) {
    // Очистка заметки: снимаем note и удаляем строку, только если она стала
    // полностью пустой. Условия deleteMany проверяются атомарно в БД, поэтому
    // одновременно выставленный статус/дедлайн защитит строку от удаления.
    await prisma.studentTopicNumberStatus.updateMany({
      where: { studentId: user.id, homeworkNumberId },
      data: { note: null }
    });
    await prisma.studentTopicNumberStatus.deleteMany({
      where: {
        studentId: user.id,
        homeworkNumberId,
        status: null,
        note: null,
        ...(deadlinesEnabled ? { deadlineAt: null } : {})
      }
    });
  } else {
    await prisma.studentTopicNumberStatus.upsert({
      where: {
        studentId_homeworkNumberId: {
          studentId: user.id,
          homeworkNumberId
        }
      },
      update: { note: nextNote },
      create: {
        studentId: user.id,
        homeworkNumberId,
        status: null,
        note: nextNote
      }
    });
  }

  revalidateTopicRoutes(topicId);
  publishDashboardRealtimeEvent({
    kind: "student-progress-changed",
    studentId: user.id,
    topicId
  });

  return NextResponse.json({
    ok: true,
    status: nextStatus,
    note: nextNote ?? "",
    notesEnabled
  });
}
