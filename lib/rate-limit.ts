import { createHash } from "node:crypto";

type HeaderSource = {
  get(name: string): string | null;
};

type RateLimitEntry = {
  hits: number[];
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  resetAt: number;
};

export type RateLimitOptions = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
  now?: number;
};

const RATE_LIMIT_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 60 * 60 * 1000;

declare global {
  var __tutorFlowRateLimitStore__: Map<string, RateLimitEntry> | undefined;
  var __tutorFlowRateLimitLastSweep__: number | undefined;
}

const rateLimitStore = global.__tutorFlowRateLimitStore__ ?? new Map<string, RateLimitEntry>();
global.__tutorFlowRateLimitStore__ = rateLimitStore;

function maybeSweepRateLimitStore(now: number) {
  const lastSweep = global.__tutorFlowRateLimitLastSweep__ ?? 0;

  if (now - lastSweep < RATE_LIMIT_SWEEP_INTERVAL_MS) {
    return;
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    const lastHit = entry.hits[entry.hits.length - 1];

    if (!lastHit || now - lastHit > RATE_LIMIT_RETENTION_MS) {
      rateLimitStore.delete(key);
    }
  }

  global.__tutorFlowRateLimitLastSweep__ = now;
}

export function buildRateLimitKey(scope: string, identifier: string) {
  return createHash("sha256")
    .update(`${scope}:${identifier}`)
    .digest("hex");
}

export function getClientIpFromHeaders(headers: HeaderSource) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstForwardedIp = forwardedFor.split(",")[0]?.trim();

    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  const xRealIp = headers.get("x-real-ip")?.trim();

  if (xRealIp) {
    return xRealIp;
  }

  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  return "unknown";
}

export function getRetryAfterSeconds(retryAfterMs: number) {
  return Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export function consumeRateLimit({
  scope,
  identifier,
  limit,
  windowMs,
  now = Date.now()
}: RateLimitOptions): RateLimitResult {
  maybeSweepRateLimitStore(now);

  const key = buildRateLimitKey(scope, identifier);
  const existing = rateLimitStore.get(key)?.hits ?? [];
  const activeHits = existing.filter((timestamp) => now - timestamp < windowMs);

  if (activeHits.length >= limit) {
    const oldestActiveHit = activeHits[0] ?? now;
    const retryAfterMs = Math.max(1, windowMs - (now - oldestActiveHit));

    rateLimitStore.set(key, { hits: activeHits });

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
      resetAt: oldestActiveHit + windowMs
    };
  }

  activeHits.push(now);
  rateLimitStore.set(key, { hits: activeHits });

  return {
    allowed: true,
    remaining: Math.max(0, limit - activeHits.length),
    retryAfterMs: 0,
    resetAt: (activeHits[0] ?? now) + windowMs
  };
}

export function resetRateLimit(scope: string, identifier: string) {
  rateLimitStore.delete(buildRateLimitKey(scope, identifier));
}

export class RateLimitExceededError extends Error {
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function assertRateLimit(options: RateLimitOptions, message = "Too many requests") {
  const result = consumeRateLimit(options);

  if (!result.allowed) {
    throw new RateLimitExceededError(message, result.retryAfterMs);
  }

  return result;
}
