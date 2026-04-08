import test from "node:test";
import assert from "node:assert/strict";
import { getEventLogContext, getHeadersLogContext, getRequestLogContext, serializeError } from "../lib/logger";

test("serializeError normalizes Error instances with common metadata", () => {
  const error = new Error("Boom") as Error & { code?: string; digest?: string };
  error.code = "P2025";
  error.digest = "abc123";

  const result = serializeError(error);

  assert.equal(result.name, "Error");
  assert.equal(result.message, "Boom");
  assert.equal(result.code, "P2025");
  assert.equal(result.digest, "abc123");
  assert.equal(typeof result.stack, "string");
});

test("getHeadersLogContext extracts request metadata and ignores empty values", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.1, 203.0.113.2",
    "user-agent": "TutorFlow Test",
    "x-request-id": "req-42"
  });

  const result = getHeadersLogContext(headers, { scope: "login" });

  assert.deepEqual(result, {
    scope: "login",
    clientIp: "203.0.113.1",
    requestId: "req-42",
    userAgent: "TutorFlow Test"
  });
});

test("getRequestLogContext adds method and path to structured request context", () => {
  const request = new Request("https://shetya.ru/api/teacher/uploads?mode=test", {
    method: "POST",
    headers: {
      "x-real-ip": "198.51.100.20"
    }
  });

  const result = getRequestLogContext(request, { feature: "uploads" });

  assert.deepEqual(result, {
    feature: "uploads",
    clientIp: "198.51.100.20",
    method: "POST",
    path: "/api/teacher/uploads"
  });
});

test("getRequestLogContext normalizes Date and bigint values for safe structured logs", () => {
  const request = new Request("https://shetya.ru/api/teacher/students", {
    method: "DELETE"
  });
  const createdAt = new Date("2026-04-08T12:00:00.000Z");

  const result = getRequestLogContext(request, {
    createdAt,
    count: 4n
  });

  assert.deepEqual(result, {
    clientIp: "unknown",
    method: "DELETE",
    path: "/api/teacher/students",
    createdAt: "2026-04-08T12:00:00.000Z",
    count: "4"
  });
});

test("getEventLogContext derives stable scope, action and outcome fields", () => {
  const result = getEventLogContext("student.create.duplicate_login", {
    teacherId: "teacher-1"
  });

  assert.deepEqual(result, {
    event: "student.create.duplicate_login",
    scope: "student",
    action: "create",
    outcome: "duplicate_login",
    teacherId: "teacher-1"
  });
});
