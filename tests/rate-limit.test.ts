import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRateLimit,
  consumeRateLimit,
  getClientIpFromHeaders,
  getRetryAfterSeconds,
  RateLimitExceededError,
  resetRateLimit
} from "../lib/rate-limit";

test("getClientIpFromHeaders prefers x-real-ip set by the reverse proxy", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 70.41.3.18",
    "x-real-ip": "198.51.100.1"
  });

  assert.equal(getClientIpFromHeaders(headers), "198.51.100.1");
});

test("getClientIpFromHeaders takes the last forwarded address (appended by our proxy)", () => {
  const headers = new Headers({
    "x-forwarded-for": "1.2.3.4, 70.41.3.18"
  });

  assert.equal(getClientIpFromHeaders(headers), "70.41.3.18");
});

test("getClientIpFromHeaders falls back through known headers", () => {
  assert.equal(getClientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(
    getClientIpFromHeaders(new Headers({ "cf-connecting-ip": "198.51.100.3" })),
    "198.51.100.3"
  );
  assert.equal(getClientIpFromHeaders(new Headers()), "unknown");
});

test("consumeRateLimit allows requests up to the configured limit", () => {
  const scope = "test-rate-limit:allow";
  const identifier = "client-1";

  resetRateLimit(scope, identifier);

  const first = consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 0 });
  const second = consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 200 });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
});

test("consumeRateLimit blocks requests above the configured limit and recovers after the window", () => {
  const scope = "test-rate-limit:block";
  const identifier = "client-2";

  resetRateLimit(scope, identifier);

  consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 0 });
  consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 200 });
  const blocked = consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 400 });
  const recovered = consumeRateLimit({ scope, identifier, limit: 2, windowMs: 1000, now: 1201 });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(blocked.retryAfterMs, 600);
  assert.equal(recovered.allowed, true);
});

test("assertRateLimit throws RateLimitExceededError with retry hint", () => {
  const scope = "test-rate-limit:error";
  const identifier = "client-3";

  resetRateLimit(scope, identifier);
  consumeRateLimit({ scope, identifier, limit: 1, windowMs: 1000, now: 0 });

  assert.throws(
    () =>
      assertRateLimit(
        { scope, identifier, limit: 1, windowMs: 1000, now: 1 },
        "Too many attempts"
      ),
    (error: unknown) => {
      assert.ok(error instanceof RateLimitExceededError);
      assert.equal(error.message, "Too many attempts");
      assert.equal(getRetryAfterSeconds(error.retryAfterMs), 1);
      return true;
    }
  );
});

test("resetRateLimit clears previously consumed hits", () => {
  const scope = "test-rate-limit:reset";
  const identifier = "client-4";

  resetRateLimit(scope, identifier);
  consumeRateLimit({ scope, identifier, limit: 1, windowMs: 1000, now: 0 });
  resetRateLimit(scope, identifier);

  const afterReset = consumeRateLimit({ scope, identifier, limit: 1, windowMs: 1000, now: 10 });
  assert.equal(afterReset.allowed, true);
});
