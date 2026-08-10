import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { publishDashboardRealtimeEvent } from "@/lib/dashboard-realtime";
import { getRequestLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { revalidateAllPlatformData } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { buildImportPlan, buildImportUpdateData, parseTopicImportText, type ImportNumber } from "@/lib/topic-import";

/*
 * Импорт номеров темы из JSON, который выдаёт внешняя ИИ по промпту из
 * lib/topic-import-prompt.ts. Живёт на странице редактирования темы, поэтому
 * цель всегда одна — эта тема; создания новых тем здесь нет.
 *
 * mode: "preview" ничего не пишет — только считает, что изменится.
 */

export const runtime = "nodejs";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CREATE_BATCH_SIZE = 200;
const SAMPLE_SIZE = 5;

type RequestBody = {
  mode?: unknown;
  /** Сырой текст файла: разбор и починка экранирования — на сервере. */
  text?: unknown;
  topicId?: unknown;
  overwriteFilled?: unknown;
};

function revalidateTopicRoutes(topicId: string) {
  revalidateAllPlatformData();
  publishDashboardRealtimeEvent({ kind: "topic-content-changed", topicId });
  revalidatePath("/dashboard");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/teacher/topics");
  revalidatePath("/student/homeworks");
  revalidatePath(`/teacher/topics/${topicId}`);
  revalidatePath(`/teacher/topics/${topicId}/edit`);
}

async function createNumbersInBatches(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  topicId: string,
  rows: Array<ImportNumber & { displayOrder: number }>
) {
  for (let start = 0; start < rows.length; start += CREATE_BATCH_SIZE) {
    const batch = rows.slice(start, start + CREATE_BATCH_SIZE);

    await tx.topicHomeworkNumber.createMany({
      data: batch.map((row) => ({
        topicId,
        number: row.number,
        displayOrder: row.displayOrder,
        conditionLatex: row.conditionLatex,
        answerLatex: row.answerLatex
      }))
    });
  }
}

export async function POST(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:topic-import", user.id, 10, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Файл слишком большой. Разбейте задачник на части по 200–300 задач." },
      { status: 413 }
    );
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const mode = body?.mode === "apply" ? "apply" : "preview";
  const topicId = typeof body?.topicId === "string" ? body.topicId.trim() : "";
  const overwriteFilled = body?.overwriteFilled === true;

  if (!topicId) {
    return NextResponse.json({ error: "Не указана тема для импорта." }, { status: 400 });
  }

  const parsed = parseTopicImportText(typeof body?.text === "string" ? body.text : "");

  if (!parsed.ok) {
    logWarnEvent(
      "topic.import.rejected",
      { ...requestContext, userId: user.id, topicId, reason: parsed.error },
      undefined,
      "Topic import payload did not pass validation."
    );

    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { title, numbers, warnings, issues } = parsed.data;

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } });

  if (!topic) {
    return NextResponse.json({ error: "Тема не найдена — возможно, её удалили." }, { status: 404 });
  }

  const existingNumbers = await prisma.topicHomeworkNumber.findMany({
    where: { topicId: topic.id },
    select: { number: true, conditionLatex: true, answerLatex: true }
  });

  const plan = buildImportPlan(numbers, existingNumbers);

  if (mode === "preview") {
    return NextResponse.json({
      fileTitle: title,
      totalInFile: numbers.length,
      willAddNumbers: plan.toCreate.length,
      willFillEmpty: plan.toFill.length,
      willOverwrite: plan.toOverwrite.length,
      untouched: plan.untouched,
      sample: numbers.slice(0, SAMPLE_SIZE),
      warnings,
      issues
    });
  }

  const toWrite = overwriteFilled ? [...plan.toFill, ...plan.toOverwrite] : plan.toFill;

  try {
    await prisma.$transaction(async (tx) => {
      const lastNumber = await tx.topicHomeworkNumber.findFirst({
        where: { topicId: topic.id },
        orderBy: { displayOrder: "desc" },
        select: { displayOrder: true }
      });

      const nextDisplayOrder = (lastNumber?.displayOrder ?? 0) + 1;

      await createNumbersInBatches(
        tx,
        topic.id,
        plan.toCreate.map((item, index) => ({ ...item, displayOrder: nextDisplayOrder + index }))
      );

      for (const item of toWrite) {
        await tx.topicHomeworkNumber.update({
          // existingNumber — записанный вид номера в теме: он может отличаться от
          // файла ведущими нулями («10203» в теме против «010203» в файле).
          where: { topicId_number: { topicId: topic.id, number: item.existingNumber } },
          // difficulty, estimatedMinutes и answerFile живут своей жизнью — импорт их
          // не трогает. answerLatex пишется только когда он есть в файле: null
          // не должен затирать введённый руками эталонный ответ (Б-2, аудит 10.08.2026).
          data: buildImportUpdateData(item)
        });
      }
    });

    revalidateTopicRoutes(topic.id);

    logInfoEvent(
      "topic.import.succeeded",
      {
        ...requestContext,
        userId: user.id,
        topicId: topic.id,
        created: plan.toCreate.length,
        filled: plan.toFill.length,
        overwritten: overwriteFilled ? plan.toOverwrite.length : 0
      },
      "Topic numbers were imported from a JSON file."
    );

    return NextResponse.json({
      created: plan.toCreate.length,
      filled: plan.toFill.length,
      overwritten: overwriteFilled ? plan.toOverwrite.length : 0,
      skipped: overwriteFilled ? 0 : plan.toOverwrite.length
    });
  } catch (error) {
    logErrorEvent(
      "topic.import.failed",
      { ...requestContext, userId: user.id, topicId: topic.id, numberCount: numbers.length },
      error,
      "Failed to import topic numbers."
    );

    return NextResponse.json(
      { error: "Не удалось записать номера в базу данных. Проверьте подключение к PostgreSQL." },
      { status: 500 }
    );
  }
}
