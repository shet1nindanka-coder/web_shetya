import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { getRequestLogContext, logErrorEvent, logInfoEvent, logWarnEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { findTopicByHomeworkNumber } from "@/lib/teacher-topic-selection";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestContext = getRequestLogContext(request);
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedNumber = Number(searchParams.get("number") ?? "");

  if (!Number.isInteger(requestedNumber) || requestedNumber <= 0) {
    return NextResponse.json({ error: "Укажите корректный номер." }, { status: 400 });
  }

  try {
    const topics = await prisma.topic.findMany({
      where: {
        homeworkNumbers: {
          some: {
            number: requestedNumber
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
            number: requestedNumber
          },
          select: {
            number: true
          }
        }
      }
    });

    const topic = findTopicByHomeworkNumber(topics, requestedNumber);

    if (!topic) {
      logWarnEvent(
        "student.topic_number_search.not_found",
        {
          ...requestContext,
          userId: user.id,
          requestedNumber
        },
        "Student topic number search returned no topic."
      );

      return NextResponse.json({ error: "Номер не найден." }, { status: 404 });
    }

    logInfoEvent(
      "student.topic_number_search.succeeded",
      {
        ...requestContext,
        userId: user.id,
        requestedNumber,
        topicId: topic.id
      },
      "Student topic number search succeeded."
    );

    return NextResponse.json({
      topicId: topic.id,
      topicTitle: topic.title,
      number: requestedNumber,
      href: `/student/topics/${topic.id}/numbers/${requestedNumber}`
    });
  } catch (error) {
    logErrorEvent(
      "student.topic_number_search.failed",
      {
        ...requestContext,
        userId: user.id,
        requestedNumber
      },
      error,
      "Student topic number search failed."
    );

    return NextResponse.json({ error: "Не удалось найти тему по номеру." }, { status: 500 });
  }
}
