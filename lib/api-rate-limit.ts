import { NextResponse } from "next/server";
import { logErrorEvent } from "@/lib/logger";
import { consumePersistentRateLimit } from "@/lib/persistent-rate-limit";
import { getRetryAfterSeconds } from "@/lib/rate-limit";

export async function enforceApiRateLimit(
  scope: string,
  userId: string,
  limit: number,
  windowMs: number
) {
  let result: Awaited<ReturnType<typeof consumePersistentRateLimit>>;

  try {
    result = await consumePersistentRateLimit({ scope, identifier: userId, limit, windowMs });
  } catch (error) {
    logErrorEvent(
      "rate_limit.persistent_consume.failed",
      { scope, userId },
      error,
      "Persistent API rate limit failed."
    );

    return NextResponse.json(
      { error: "Сервис временно недоступен. Попробуйте снова позже." },
      {
        status: 503,
        headers: { "Retry-After": "5" }
      }
    );
  }

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
