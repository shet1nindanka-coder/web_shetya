import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { tryGetCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTopicNumbersChangePlan, loadTopicNumberFacts } from "@/lib/topic-numbers-change";
import { parseNumbersInput } from "@/lib/utils";

/*
 * Предпросмотр правки поля «Номера» на странице темы: что именно исчезнет,
 * если сохранить форму в текущем виде. Ничего не пишет в базу.
 *
 * Нужен, чтобы разрушающее сохранение (PROD-002) требовало осознанного «да»:
 * клиент показывает список последствий, сервер потом ещё раз пересчитывает план
 * и сверяет подтверждение — на UI-флаг тут полагаться нельзя.
 */

export const runtime = "nodejs";

type RequestBody = {
  topicId?: unknown;
  numbers?: unknown;
};

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.DEVELOPER) {
    return NextResponse.json({ error: "Нужны права разработчика." }, { status: 401 });
  }

  const rateLimitResponse = await enforceApiRateLimit("api:topic-numbers-preview", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null;
  const topicId = String(body?.topicId ?? "").trim();
  const numbers = parseNumbersInput(String(body?.numbers ?? ""));

  if (!topicId) {
    return NextResponse.json({ error: "Не указана тема." }, { status: 400 });
  }

  if (numbers.length === 0) {
    return NextResponse.json({ error: "Список номеров пуст — тема не может остаться без номеров." }, { status: 400 });
  }

  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { id: true } });

  if (!topic) {
    return NextResponse.json({ error: "Тема не найдена." }, { status: 404 });
  }

  const plan = buildTopicNumbersChangePlan(await loadTopicNumberFacts(topicId), numbers);

  return NextResponse.json({
    keptCount: plan.keptCount,
    added: plan.added,
    requiresConfirmation: plan.requiresConfirmation,
    requiresAssignedConfirmation: plan.requiresAssignedConfirmation,
    removed: plan.removed.map((entry) => ({
      number: entry.number,
      summary: entry.summary,
      hasStudentWork: entry.hasStudentWork,
      isAssigned: entry.isAssigned
    }))
  });
}
