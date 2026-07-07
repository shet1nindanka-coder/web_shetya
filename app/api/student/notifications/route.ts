import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { tryGetCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit } from "@/lib/api-rate-limit";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:notifications", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = await listNotifications(user.id);

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  const user = await tryGetCurrentUser();

  if (!user || user.role !== UserRole.STUDENT) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = enforceApiRateLimit(request, "api:notifications", user.id, 60, 60_000);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const body = (await request.json().catch(() => null)) as { notificationId?: string } | null;
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId : undefined;

  await markNotificationsRead(user.id, notificationId);

  return NextResponse.json({ ok: true });
}
