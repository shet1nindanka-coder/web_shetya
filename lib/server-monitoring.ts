import * as Sentry from "@sentry/nextjs";
import { logError } from "@/lib/logger";

type MonitoringContext = Record<string, unknown>;

function normalizeMonitoringValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return value;
}

export function reportServerError(message: string, context: MonitoringContext = {}, error?: unknown) {
  logError(message, context, error);

  const sentryError =
    error instanceof Error ? error : new Error(`${message}${error ? `: ${String(error)}` : ""}`);

  Sentry.withScope((scope) => {
    const userId = context.userId;

    if (userId !== undefined && userId !== null) {
      scope.setUser({ id: String(userId) });
    }

    for (const [key, value] of Object.entries(context)) {
      const normalizedValue = normalizeMonitoringValue(value);

      if (normalizedValue === undefined) {
        continue;
      }

      if (
        key === "userId" ||
        key === "studentId" ||
        key === "topicId" ||
        key === "fileId" ||
        key === "method" ||
        key === "path" ||
        key === "scope" ||
        key === "requestId"
      ) {
        scope.setTag(key, String(normalizedValue));
        continue;
      }

      scope.setExtra(key, normalizedValue);
    }

    scope.setExtra("logMessage", message);
    scope.captureException(sentryError);
  });
}
