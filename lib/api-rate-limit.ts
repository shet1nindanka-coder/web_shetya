import { NextResponse } from "next/server";
import { consumeRateLimit, getClientIpFromHeaders, getRetryAfterSeconds } from "@/lib/rate-limit";

export function enforceApiRateLimit(
  request: Request | null,
  scope: string,
  userId: string,
  limit: number,
  windowMs: number
) {
  const ip = request ? getClientIpFromHeaders(request.headers) : "local";
  const result = consumeRateLimit({ scope, identifier: `${userId}:${ip}`, limit, windowMs });

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: "Слишком много запросов. Подождите немного и попробуйте снова." },
    {
      status: 429,
      headers: { "Retry-After": String(getRetryAfterSeconds(result.retryAfterMs)) }
    }
  );
}
