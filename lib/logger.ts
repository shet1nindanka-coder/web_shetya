import { hostname } from "node:os";
import pino from "pino";
import { getClientIpFromHeaders } from "@/lib/rate-limit";

type HeaderSource = {
  get(name: string): string | null;
};

type LogContext = Record<string, unknown>;

const loggerLevel = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const loggerHostname = hostname();

type LogEventDescriptor = {
  event: string;
  scope?: string;
  action?: string;
  outcome?: string;
};

function normalizeLogValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeLogValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, normalizeLogValue(entryValue)])
    );
  }

  return value;
}

function compactContext<T extends LogContext>(context: T): T {
  return Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => [key, normalizeLogValue(value)])
  ) as T;
}

function splitLogEvent(event: string): LogEventDescriptor {
  const normalizedEvent = event.trim();
  const parts = normalizedEvent
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { event: normalizedEvent || "unknown" };
  }

  if (parts.length === 1) {
    return {
      event: normalizedEvent,
      scope: parts[0]
    };
  }

  if (parts.length === 2) {
    return {
      event: normalizedEvent,
      scope: parts[0],
      action: parts[1]
    };
  }

  return {
    event: normalizedEvent,
    scope: parts[0],
    action: parts.slice(1, -1).join("."),
    outcome: parts.at(-1)
  };
}

function buildLogMessage(event: string, message?: string) {
  const normalizedMessage = message?.trim();
  return normalizedMessage ? `${event} | ${normalizedMessage}` : event;
}

function getRequestId(headers: HeaderSource) {
  return (
    headers.get("x-request-id")?.trim() ??
    headers.get("x-correlation-id")?.trim() ??
    headers.get("cf-ray")?.trim() ??
    headers.get("x-vercel-id")?.trim() ??
    undefined
  );
}

export const logger = pino({
  level: loggerLevel,
  base: {
    hostname: loggerHostname,
    pid: process.pid,
    service: "shbz-school",
    env: process.env.NODE_ENV ?? "development"
  },
  messageKey: "message",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label })
  }
});

export function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    const details: LogContext = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    const errorWithExtras = error as Error & {
      code?: unknown;
      digest?: unknown;
      cause?: unknown;
    };

    if (errorWithExtras.code !== undefined) {
      details.code = errorWithExtras.code;
    }

    if (errorWithExtras.digest !== undefined) {
      details.digest = errorWithExtras.digest;
    }

    if (errorWithExtras.cause !== undefined) {
      details.cause = serializeError(errorWithExtras.cause);
    }

    return compactContext(details);
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    return error as LogContext;
  }

  return { value: error };
}

export function getHeadersLogContext(headers: HeaderSource, extra: LogContext = {}) {
  return compactContext({
    ...extra,
    clientIp: getClientIpFromHeaders(headers),
    requestId: getRequestId(headers),
    forwardedProto: headers.get("x-forwarded-proto")?.trim() ?? undefined,
    userAgent: headers.get("user-agent")?.trim() ?? undefined
  });
}

export function getRequestLogContext(request: Request, extra: LogContext = {}) {
  const url = new URL(request.url);

  return compactContext({
    ...getHeadersLogContext(request.headers),
    ...extra,
    method: request.method,
    path: url.pathname
  });
}

export function getEventLogContext(event: string, context: LogContext = {}) {
  return compactContext({
    ...splitLogEvent(event),
    ...context
  });
}

export function logInfo(message: string, context: LogContext = {}) {
  logger.info(compactContext(context), message);
}

export function logWarn(message: string, context: LogContext = {}, error?: unknown) {
  logger.warn(
    compactContext({
      ...context,
      error: error === undefined ? undefined : serializeError(error)
    }),
    message
  );
}

export function logError(message: string, context: LogContext = {}, error?: unknown) {
  logger.error(
    compactContext({
      ...context,
      error: error === undefined ? undefined : serializeError(error)
    }),
    message
  );
}

export function logInfoEvent(event: string, context: LogContext = {}, message?: string) {
  logger.info(getEventLogContext(event, context), buildLogMessage(event, message));
}

export function logWarnEvent(event: string, context: LogContext = {}, error?: unknown, message?: string) {
  logger.warn(
    compactContext({
      ...getEventLogContext(event, context),
      error: error === undefined ? undefined : serializeError(error)
    }),
    buildLogMessage(event, message)
  );
}

export function logErrorEvent(event: string, context: LogContext = {}, error?: unknown, message?: string) {
  logger.error(
    compactContext({
      ...getEventLogContext(event, context),
      error: error === undefined ? undefined : serializeError(error)
    }),
    buildLogMessage(event, message)
  );
}
