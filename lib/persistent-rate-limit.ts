import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildRateLimitKey,
  type RateLimitOptions,
  type RateLimitResult
} from "@/lib/rate-limit";

const SERIALIZABLE_RETRY_ATTEMPTS = 4;
const BUCKET_CLEANUP_PROBABILITY = 0.01;
const BUCKET_MAX_AGE_MS = 30 * 24 * 60 * 60_000;

function isRetryableSerializableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

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

  for (let attempt = 1; attempt <= SERIALIZABLE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const existing = await transaction.rateLimitBucket.findUnique({
            where: {
              key
            }
          });

          if (!existing || existing.windowStart.getTime() !== windowStartMs) {
            await transaction.rateLimitBucket.upsert({
              where: {
                key
              },
              create: {
                key,
                windowStart,
                hits: 1
              },
              update: {
                windowStart,
                hits: 1
              }
            });

            return {
              allowed: true,
              remaining: Math.max(0, limit - 1),
              retryAfterMs: 0,
              resetAt
            };
          }

          if (existing.hits >= limit) {
            return {
              allowed: false,
              remaining: 0,
              retryAfterMs: Math.max(1, resetAt - now),
              resetAt
            };
          }

          const updated = await transaction.rateLimitBucket.update({
            where: {
              key
            },
            data: {
              hits: {
                increment: 1
              }
            },
            select: {
              hits: true
            }
          });

          return {
            allowed: true,
            remaining: Math.max(0, limit - updated.hits),
            retryAfterMs: 0,
            resetAt
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        }
      );
    } catch (error) {
      if (attempt < SERIALIZABLE_RETRY_ATTEMPTS && isRetryableSerializableError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Persistent rate limit retry attempts exhausted.");
}

export async function resetPersistentRateLimit(scope: string, identifier: string) {
  await prisma.rateLimitBucket.deleteMany({
    where: {
      key: buildRateLimitKey(scope, identifier)
    }
  });
}
