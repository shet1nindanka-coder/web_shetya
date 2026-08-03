import { Prisma, SolutionCheckStatus, SolutionVerdict, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { logInfoEvent, logWarnEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import {
  AI_CHECK_GLOBAL_BUDGET_IDENTIFIER,
  AI_CHECK_GLOBAL_BUDGET_SCOPE,
  AI_CHECK_GLOBAL_BUDGET_WINDOW_MS,
  failStaleHomeworkChecks,
  getAiCheckConfig
} from "@/lib/solution-check";
import { enqueueHomeworkCheck, getHomeworkCheckQueueLength } from "@/lib/solution-check-queue";
import { toStudentFacingResults } from "@/lib/solution-check-student-view";
import { getSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

function isMissingCheckTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkCheck") ||
      error.message.includes("HomeworkCheckPhoto") ||
      error.message.includes("HomeworkAssignment"))
  );
}

function isUniqueActiveCheckError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isSnapshotConflictError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  // Предохранители от неограниченных расходов на модель: глобальный дневной
  // бюджет запусков (на всех учеников) и потолок длины in-memory очереди.
  // Значения управляются панелью разработчика (/developer/panel).
  //
  // Дневной бюджет списывается НЕ здесь, а ниже — вплотную к постановке в
  // очередь, когда уже известно, что проверять реально есть что. Раньше он
  // списывался первым, и десяток запросов с несуществующим assignmentId сжигал
  // десяток общих слотов, не потратив на модель ни копейки (SEC-006). Почасовой
  // лимит на ученика, наоборот, остаётся ранним: он для того и нужен, чтобы
  // гасить долбёжку до всякой работы.
  const settings = await getSiteSettings();

  if (getHomeworkCheckQueueLength() >= 20) {
    return NextResponse.json(
      { error: "Очередь автопроверки переполнена. Попробуйте через несколько минут." },
      { status: 503, headers: { "Retry-After": "120" } }
    );
  }

  const rateLimitResponse = await enforceApiRateLimit(
    "api:homework-checks",
    user.id,
    settings.aiPerStudentHourlyLimit,
    60 * 60_000
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!settings.aiEnabled || !getAiCheckConfig(settings)) {
    return NextResponse.json(
      { error: "Автоматическая проверка сейчас отключена. Попросите разработчика включить её." },
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

  let startResult:
    | { kind: "created"; checkId: string; assignmentId: string }
    | { kind: "missing" }
    | { kind: "no-photos" }
    | { kind: "no-numbers" };

  try {
    startResult = await prisma.$transaction(async (transaction) => {
      const assignment = await transaction.homeworkAssignment.findFirst({
        where: {
          id: assignmentId,
          studentId: user.id
        },
        select: {
          id: true,
          photos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { fileId: true }
          },
          _count: {
            select: { numbers: true }
          }
        }
      });

      if (!assignment) {
        return { kind: "missing" as const };
      }

      if (assignment.photos.length === 0) {
        return { kind: "no-photos" as const };
      }

      if (assignment._count.numbers === 0) {
        return { kind: "no-numbers" as const };
      }

      const check = await transaction.homeworkCheck.create({
        data: {
          assignmentId: assignment.id,
          activeSlot: 1,
          photos: {
            create: assignment.photos.map((photo, order) => ({
              fileId: photo.fileId,
              order
            }))
          }
        },
        select: { id: true }
      });

      return {
        kind: "created" as const,
        checkId: check.id,
        assignmentId: assignment.id
      };
    });
  } catch (error) {
    if (isMissingCheckTableError(error)) {
      return NextResponse.json(
        { error: "Таблица проверок ещё не создана в PostgreSQL. Сначала примените миграцию." },
        { status: 503 }
      );
    }

    if (isUniqueActiveCheckError(error)) {
      return NextResponse.json({ error: "Проверка уже идёт — дождитесь результата." }, { status: 409 });
    }

    if (isSnapshotConflictError(error)) {
      return NextResponse.json(
        { error: "Набор фото изменился. Повторите запуск проверки." },
        { status: 409 }
      );
    }

    throw error;
  }

  if (startResult.kind === "missing") {
    return NextResponse.json({ error: "ДЗ не найдено." }, { status: 404 });
  }

  if (startResult.kind === "no-photos") {
    return NextResponse.json({ error: "Сначала прикрепите фото решения." }, { status: 400 });
  }

  if (startResult.kind === "no-numbers") {
    return NextResponse.json({ error: "В этом ДЗ нет номеров для проверки." }, { status: 400 });
  }

  // Проверять есть что — теперь можно занять слот дневного бюджета.
  const globalLimitResponse = await enforceApiRateLimit(
    AI_CHECK_GLOBAL_BUDGET_SCOPE,
    AI_CHECK_GLOBAL_BUDGET_IDENTIFIER,
    settings.aiDailyLimit,
    AI_CHECK_GLOBAL_BUDGET_WINDOW_MS
  );

  if (globalLimitResponse) {
    // Бюджет кончился уже после создания строки проверки — убираем её, иначе
    // ученик останется с вечным PENDING, который никто не подхватит.
    await prisma.homeworkCheck.delete({ where: { id: startResult.checkId } }).catch((error: unknown) => {
      logWarnEvent(
        "solution.check.budget_rollback_failed",
        { checkId: startResult.checkId, studentId: user.id },
        error,
        "Failed to remove a check row after the daily AI budget was exhausted."
      );
    });

    return globalLimitResponse;
  }

  enqueueHomeworkCheck(startResult.checkId);
  logInfoEvent("solution.check.enqueued", {
    checkId: startResult.checkId,
    assignmentId: startResult.assignmentId,
    studentId: user.id
  });

  return NextResponse.json({ ok: true, checkId: startResult.checkId });
}

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Сессия истекла. Войдите заново." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit(
    "api:homework-check-status",
    user.id,
    120,
    60_000
  );

  if (rateLimitResponse) {
    return rateLimitResponse;
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
          verdict: SolutionVerdict;
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
      // Ученику отдаём урезанный вид: у неуверенного вердикта комментарий модели
      // писался под другой вывод и как утверждение больше не годится (PROD-011).
      // Полный результат с диагностикой остаётся у учителя.
      results: toStudentFacingResults(
        check.results.map((result) => ({
          number: result.homeworkNumber.number,
          verdict: result.verdict,
          recognizedAnswer: result.recognizedAnswer,
          comment: result.comment
        }))
      )
    }
  });
}
