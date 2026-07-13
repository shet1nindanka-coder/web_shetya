import { Prisma, SolutionCheckStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { logInfoEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { failStaleHomeworkChecks, getAiCheckConfig } from "@/lib/solution-check";
import { enqueueHomeworkCheck } from "@/lib/solution-check-queue";

export const runtime = "nodejs";

function isMissingCheckTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkCheck") || error.message.includes("HomeworkAssignment"))
  );
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:homework-checks", user.id, 10, 60 * 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!getAiCheckConfig()) {
    return NextResponse.json(
      { error: "Автоматическая проверка пока не подключена. Попросите разработчика настроить её." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { assignmentId?: string } | null;
  const assignmentId = String(body?.assignmentId ?? "").trim();

  if (!assignmentId) {
    return NextResponse.json({ error: "Некорректные данные для проверки." }, { status: 400 });
  }

  // Освобождаем «зависшие» проверки (например, прерванные рестартом сервера),
  // иначе счётчик активных навсегда заблокирует повторный запуск (409).
  await failStaleHomeworkChecks(assignmentId, user.id);

  let assignment: { id: string; photosCount: number; numbersCount: number; activeChecks: number } | null;

  try {
    const found = await prisma.homeworkAssignment.findFirst({
      where: {
        id: assignmentId,
        studentId: user.id
      },
      select: {
        id: true,
        _count: {
          select: {
            photos: true,
            numbers: true,
            checks: {
              where: {
                status: { in: [SolutionCheckStatus.PENDING, SolutionCheckStatus.CHECKING] }
              }
            }
          }
        }
      }
    });

    assignment = found
      ? {
          id: found.id,
          photosCount: found._count.photos,
          numbersCount: found._count.numbers,
          activeChecks: found._count.checks
        }
      : null;
  } catch (error) {
    if (isMissingCheckTableError(error)) {
      return NextResponse.json(
        { error: "Таблица проверок ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    throw error;
  }

  if (!assignment) {
    return NextResponse.json({ error: "ДЗ не найдено." }, { status: 404 });
  }

  if (assignment.photosCount === 0) {
    return NextResponse.json({ error: "Сначала прикрепите фото решения." }, { status: 400 });
  }

  if (assignment.numbersCount === 0) {
    return NextResponse.json({ error: "В этом ДЗ нет номеров для проверки." }, { status: 400 });
  }

  if (assignment.activeChecks > 0) {
    return NextResponse.json({ error: "Проверка уже идёт — дождитесь результата." }, { status: 409 });
  }

  const check = await prisma.homeworkCheck.create({
    data: { assignmentId: assignment.id },
    select: { id: true }
  });

  enqueueHomeworkCheck(check.id);
  logInfoEvent("solution.check.enqueued", { checkId: check.id, assignmentId: assignment.id, studentId: user.id });

  return NextResponse.json({ ok: true, checkId: check.id });
}

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const url = new URL(request.url);
  const assignmentId = String(url.searchParams.get("assignmentId") ?? "").trim();

  if (!assignmentId) {
    return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
  }

  // Помечаем зависшую проверку как проваленную, чтобы поллинг ученика увидел
  // терминальный статус, а не бесконечное «идёт проверка».
  await failStaleHomeworkChecks(assignmentId, user.id);

  let check:
    | {
        id: string;
        status: SolutionCheckStatus;
        error: string | null;
        checkedAt: Date | null;
        results: Array<{
          verdict: string;
          recognizedAnswer: string | null;
          comment: string | null;
          homeworkNumber: { number: number };
        }>;
      }
    | null;

  try {
    check = await prisma.homeworkCheck.findFirst({
      where: {
        assignmentId,
        assignment: {
          studentId: user.id
        }
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        error: true,
        checkedAt: true,
        results: {
          select: {
            verdict: true,
            recognizedAnswer: true,
            comment: true,
            homeworkNumber: {
              select: { number: true }
            }
          }
        }
      }
    });
  } catch (error) {
    if (isMissingCheckTableError(error)) {
      return NextResponse.json({ check: null });
    }

    throw error;
  }

  if (!check) {
    return NextResponse.json({ check: null });
  }

  const isFinished = check.status === SolutionCheckStatus.DONE || check.status === SolutionCheckStatus.FAILED;

  if (isFinished && url.searchParams.get("consume") === "1") {
    revalidateAllPlatformData();
    revalidatePath("/student/homeworks");
    revalidatePath(`/student/homeworks/${assignmentId}`);
    revalidatePath("/teacher/students");
  }

  return NextResponse.json({
    check: {
      id: check.id,
      status: check.status,
      error: check.error,
      checkedAt: check.checkedAt ? check.checkedAt.toISOString() : null,
      results: check.results
        .map((result) => ({
          number: result.homeworkNumber.number,
          verdict: result.verdict,
          recognizedAnswer: result.recognizedAnswer,
          comment: result.comment
        }))
        .sort((left, right) => left.number - right.number)
    }
  });
}
