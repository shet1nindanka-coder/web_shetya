import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

function revalidateDeadlineRoutes(studentId: string, topicId: string) {
  revalidateAllPlatformData();
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/student/topics");
  revalidatePath(`/student/topics/${topicId}`);
  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath(`/teacher/students/${studentId}`);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.TEACHER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        studentId?: string;
        topicId?: string;
        homeworkNumberId?: string;
        deadlineAt?: string | null;
      }
    | null;

  const studentId = String(body?.studentId ?? "").trim();
  const topicId = String(body?.topicId ?? "").trim();
  const homeworkNumberId = String(body?.homeworkNumberId ?? "").trim();
  const rawDeadline = body?.deadlineAt;
  const deadlineAt =
    typeof rawDeadline === "string" && rawDeadline.trim()
      ? new Date(rawDeadline)
      : rawDeadline === null
        ? null
        : undefined;

  if (!studentId || !topicId || !homeworkNumberId || deadlineAt === undefined || Number.isNaN(deadlineAt?.getTime())) {
    return NextResponse.json({ error: "Некорректные данные для дедлайна." }, { status: 400 });
  }

  const [student, homeworkNumber] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id: studentId,
        role: UserRole.STUDENT
      },
      select: { id: true }
    }),
    prisma.topicHomeworkNumber.findFirst({
      where: {
        id: homeworkNumberId,
        topicId
      },
      select: { id: true }
    })
  ]);

  if (!student || !homeworkNumber) {
    return NextResponse.json({ error: "Ученик или номер задания не найден." }, { status: 404 });
  }

  let notesEnabled = true;
  let existingStatus:
    | {
        status: string | null;
        note?: string | null;
      }
    | null = null;

  try {
    existingStatus = await prisma.studentTopicNumberStatus.findUnique({
      where: {
        studentId_homeworkNumberId: {
          studentId,
          homeworkNumberId
        }
      },
      select: {
        status: true,
        note: true
      }
    });
  } catch (error) {
    if (!isMissingStudentDeadlineColumnError(error) && !isMissingStudentNoteColumnError(error)) {
      throw error;
    }

    notesEnabled = !isMissingStudentNoteColumnError(error);
    existingStatus = await prisma.studentTopicNumberStatus.findUnique({
      where: {
        studentId_homeworkNumberId: {
          studentId,
          homeworkNumberId
        }
      },
      select: {
        status: true
      }
    });
  }

  try {
    if (!deadlineAt && !existingStatus?.status && !existingStatus?.note) {
      await prisma.studentTopicNumberStatus.deleteMany({
        where: {
          studentId,
          homeworkNumberId
        }
      });
    } else {
      await prisma.studentTopicNumberStatus.upsert({
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
          ...(notesEnabled ? { note: null } : {}),
          deadlineAt
        }
      });
    }
  } catch (error) {
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

  revalidateDeadlineRoutes(studentId, topicId);

  return NextResponse.json({
    ok: true,
    deadlineAt: deadlineAt ? deadlineAt.toISOString() : null,
    deadlinesEnabled: true
  });
}
