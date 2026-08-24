import { prisma } from "@/lib/prisma";
import {
  buildRateLimitKey,
  type RateLimitOptions,
  type RateLimitResult
} from "@/lib/rate-limit";

const BUCKET_CLEANUP_PROBABILITY = 0.01;
const BUCKET_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

export async function consumePersistentRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
  now = Date.now()
}: RateLimitOptions): Promise<RateLimitResult> {
  // Оппортунистическая уборка: изредка удаляем бакеты, не обновлявшиеся месяц
  // (случайные IP на логине иначе копятся вечно). Fire-and-forget.
  if (Math.random() < BUCKET_CLEANUP_PROBABILITY) {
    void prisma.rateLimitBucket
      .deleteMany({ where: { updatedAt: { lt: new Date(now - BUCKET_MAX_AGE_MS) } } })
      .catch(() => undefined);
  }

  const key = buildRateLimitKey(scope, identifier);
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetAt = windowStartMs + windowMs;

  // Один атомарный upsert вместо SERIALIZABLE-транзакции с read-then-write.
  // Та транзакция конфликтовала сама с собой: параллельные запросы одного
  // пользователя бьются в одну строку, Postgres отменяет их как write conflict,
  // и после исчерпания ретраев запрос уходил в 503. На 40 параллельных вызовах
  // так падала ровно половина. Здесь конкуренция разруливается блокировкой
  // строки внутри одного запроса — отменять нечего.
  const [row] = await prisma.$queryRaw<Array<{ hits: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "hits", "updatedAt")
    VALUES (${key}, ${windowStart}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE
    SET "hits" = CASE
          WHEN "RateLimitBucket"."windowStart" <> ${windowStart} THEN 1
          ELSE "RateLimitBucket"."hits" + 1
        END,
        "windowStart" = ${windowStart},
        "updatedAt" = NOW()
    RETURNING "hits"
  `;

  const hits = row?.hits ?? 1;

  if (hits > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(1, resetAt - now),
      resetAt
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - hits),
    retryAfterMs: 0,
    resetAt
  };
}

/**
 * Возвращает один списанный слот обратно в текущее окно.
 *
 * Нужно там, где счётчик — это бюджет на дорогую внешнюю операцию, а не защита
 * от долбёжки: если запрос не дошёл до модели (нечего проверять, автопроверка
 * выключена, фото не читаются), деньги не потрачены и слот занимать нечестно.
 *
 * Окно проверяется по `windowStart`: если оно уже сменилось, возвращать нечего —
 * счётчик и так начался заново.
 */
export async function releasePersistentRateLimitHit({
  scope,
  identifier,
  windowMs,
  amount = 1,
  now = Date.now()
}: {
  scope: string;
  identifier: string;
  windowMs: number;
  amount?: number;
  now?: number;
}) {
  if (!Number.isInteger(amount) || amount < 1) {
    return;
  }

  const key = buildRateLimitKey(scope, identifier);
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  // `hits: { gte: amount }` вместо клампа: если вернуть больше, чем занято,
  // счётчик ушёл бы в минус и окно стало бы бесконечным.
  await prisma.rateLimitBucket.updateMany({
    where: {
      key,
      windowStart,
      hits: { gte: amount }
    },
    data: {
      hits: { decrement: amount }
    }
  });
}

export async function resetPersistentRateLimit(scope: string, identifier: string) {
  await prisma.rateLimitBucket.deleteMany({
    where: {
      key: buildRateLimitKey(scope, identifier)
    }
  });
}
