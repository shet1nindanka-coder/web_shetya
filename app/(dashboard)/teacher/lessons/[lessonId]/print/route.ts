import { LessonKind, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { buildLessonPrintPayload } from "@/lib/lesson-print-data";
import { renderLessonAnswersHtml, renderLessonPrintHtml } from "@/lib/lesson-print-html";
import { embedKatexAssets } from "@/lib/print-theme";

export const runtime = "nodejs";

/** HTML-версия раздатки: отладка вёрстки и фолбэк, когда Chromium недоступен. */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const user = await tryGetCurrentUser();

  if (!user || (user.role !== UserRole.TEACHER && user.role !== UserRole.DEVELOPER)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("lesson-pdf", user.id, 30, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { lessonId } = await params;
  const url = new URL(request.url);
  const studentId = url.searchParams.get("studentId");
  const answersOnly = url.searchParams.get("answers") === "1";

  const payload = await buildLessonPrintPayload(user, lessonId, studentId);

  if (!payload || payload.printData.participants.length === 0) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  // У плана ИИ-ДЗ раздатки нет (ученик работает в кабинете) — печатаются только ответы.
  if (payload.lesson.kind !== LessonKind.LESSON && !answersOnly) {
    return NextResponse.json({ error: "У домашнего задания нет печатной раздатки — только лист ответов." }, { status: 404 });
  }

  const html = answersOnly ? renderLessonAnswersHtml(payload.printData) : renderLessonPrintHtml(payload.printData);

  return new NextResponse(embedKatexAssets(html), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
