import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { jsonResponse } from "@/lib/api-json";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
import { ensureDeveloperAlerts } from "@/lib/developer-alerts";
import { ensureParentCallDueNotifications } from "@/lib/parent-calls";
import { getRequestLogContext, logWarnEvent } from "@/lib/logger";

export const runtime = "nodejs";

/*
 * Уведомления для любой авторизованной роли. Существующий
 * /api/student/notifications остаётся для кабинета ученика; этот маршрут
 * обслуживает колокольчик учителя (и любые будущие роли). Для учителя GET
 * заодно лениво генерирует напоминания «пора созвониться с родителями»,
 * для разработчика — служебные алерты (ошибки, бюджет ИИ, зависшие проверки,
 * хранилище) из lib/developer-alerts.ts.
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

  if (user.role === UserRole.DEVELOPER) {
    try {
      await ensureDeveloperAlerts(user.id);
    } catch (error) {
      logWarnEvent(
        "notifications.developer_alerts_ensure.failed",
        { ...getRequestLogContext(request), userId: user.id },
        error,
        "Failed to ensure developer alerts."
      );
    }
  }

  const payload = await listNotifications(user.id);

  return jsonResponse(request, payload);
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
