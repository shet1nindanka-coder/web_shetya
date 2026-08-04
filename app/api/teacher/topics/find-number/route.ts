import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { getRequestLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { findTopicByHomeworkNumber } from "@/lib/teacher-topic-selection";
import { normalizeHomeworkNumber } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:find-number", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { searchParams } = new URL(request.url);
  const requestedNumber = (searchParams.get("number") ?? "").trim();
  // Поиск по нормализованному виду: «1023» и «001023» находят один номер.
  // Срезать ведущие нули в Prisma нельзя, поэтому endsWith сужает выборку,
  // а точное совпадение проверяет findTopicByHomeworkNumber.
  const normalizedNumber = normalizeHomeworkNumber(requestedNumber);

  if (!/^\d{1,20}$/.test(requestedNumber) || normalizedNumber === "0") {
    return NextResponse.json({ error: "Укажите корректный номер." }, { status: 400 });
  }

  try {
    const topics = await prisma.topic.findMany({
      where: {
        homeworkNumbers: {
          some: {
            number: { endsWith: normalizedNumber }
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        displayOrder: true,
        createdAt: true,
        homeworkNumbers: {
          where: {
            number: { endsWith: normalizedNumber }
          },
          select: {
            number: true
          }
        }
      }
    });

    const topic = findTopicByHomeworkNumber(topics, requestedNumber);
    // В ответ уходит записанный вид номера — как в задачнике, а не как набрали.
    const recordedNumber =
      topic?.homeworkNumbers.find((entry) => normalizeHomeworkNumber(entry.number) === normalizedNumber)?.number ??
      requestedNumber;

    if (!topic) {
      logWarnEvent(
        "teacher.topic_number_search.not_found",
        {
          ...requestContext,
          userId: user.id,
          requestedNumber
        },
        "Teacher topic number search returned no topic."
      );

      return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
    }

    logInfoEvent(
      "teacher.topic_number_search.succeeded",
      {
        ...requestContext,
        userId: user.id,
        requestedNumber,
        topicId: topic.id
      },
      "Teacher topic number search succeeded."
    );

    return NextResponse.json({
      topicId: topic.id,
      topicTitle: topic.title,
      number: recordedNumber,
      href: `/teacher/topics/${topic.id}/numbers/${encodeURIComponent(recordedNumber)}`
    });
  } catch (error) {
    logErrorEvent(
      "teacher.topic_number_search.failed",
      {
        ...requestContext,
        userId: user.id,
        requestedNumber
      },
      error,
      "Teacher topic number search failed."
    );

    return NextResponse.json({ error: "Не удалось найти тему по номеру." }, { status: 500 });
  }
}
