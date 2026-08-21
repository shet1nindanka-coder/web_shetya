import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
import { ensureParentCallDueNotifications } from "@/lib/parent-calls";
import { getRequestLogContext, logWarnEvent } from "@/lib/logger";

export const runtime = "nodejs";

/*
 * Уведомления для любой авторизованной роли. Существующий
 * /api/student/notifications остаётся для кабинета ученика; этот маршрут
 * обслуживает колокольчик учителя (и любые будущие роли). Для учителя GET
 * заодно лениво генерирует напоминания «пора созвониться с родителями».
 */

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role === UserRole.TEACHER) {
    try {
      await ensureParentCallDueNotifications(user.id);
    } catch (error) {
      logWarnEvent(
        "notifications.parent_call_ensure.failed",
        { ...getRequestLogContext(request), userId: user.id },
        error,
        "Failed to ensure parent call notifications."
      );
    }
  }

  const payload = await listNotifications(user.id);

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { notificationId?: string } | null;
  const notificationId = body?.notificationId ? String(body.notificationId) : undefined;

  await markNotificationsRead(user.id, notificationId);

  return NextResponse.json({ success: true });
}
