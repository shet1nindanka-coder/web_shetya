import { UserRole } from "@prisma/client";
import { logWarnEvent } from "@/lib/logger";

export type DashboardRealtimeEvent =
  | {
      kind: "students-changed";
      occurredAt: string;
    }
  | {
      kind: "topic-content-changed";
      occurredAt: string;
      topicId?: string;
    }
  | {
      kind: "student-progress-changed";
      occurredAt: string;
      studentId: string;
      topicId?: string;
    }
  | {
      kind: "student-deadlines-changed";
      occurredAt: string;
      studentId: string;
      topicId?: string;
    }
  | {
      // Живой урок: старт/завершение, сдача фото, результат проверки,
      // ручная переразметка итога. studentId — чьё действие (для доставки
      // ученику); учитель получает события своих уроков целиком.
      kind: "lesson-activity";
      occurredAt: string;
      lessonId: string;
      teacherId: string;
      studentId?: string;
    };

type DashboardRealtimeListener = (event: DashboardRealtimeEvent) => void;
type DashboardRealtimeEventInput = DashboardRealtimeEvent extends infer Event
  ? Event extends { occurredAt: string }
    ? Omit<Event, "occurredAt">
    : never
  : never;

declare global {
  var __dashboardRealtimeListeners__: Set<DashboardRealtimeListener> | undefined;
  var __dashboardRealtimeConnectionCounts__: Map<string, number> | undefined;
}

const listeners = global.__dashboardRealtimeListeners__ ?? new Set<DashboardRealtimeListener>();
global.__dashboardRealtimeListeners__ = listeners;

const connectionCounts =
  global.__dashboardRealtimeConnectionCounts__ ?? new Map<string, number>();
global.__dashboardRealtimeConnectionCounts__ = connectionCounts;

export const DASHBOARD_REALTIME_MAX_CONNECTIONS_PER_USER = 2;

export function acquireDashboardRealtimeConnection(userId: string) {
  const currentCount = connectionCounts.get(userId) ?? 0;

  if (currentCount >= DASHBOARD_REALTIME_MAX_CONNECTIONS_PER_USER) {
    return null;
  }

  connectionCounts.set(userId, currentCount + 1);
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    const nextCount = (connectionCounts.get(userId) ?? 1) - 1;

    if (nextCount <= 0) {
      connectionCounts.delete(userId);
      return;
    }

    connectionCounts.set(userId, nextCount);
  };
}

export function publishDashboardRealtimeEvent(event: DashboardRealtimeEventInput) {
  const payload = {
    ...event,
    occurredAt: new Date().toISOString()
  } as DashboardRealtimeEvent;

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      logWarnEvent(
        "realtime.listener.failed",
        { eventKind: payload.kind },
        error,
        "Dashboard realtime listener failed."
      );
    }
  });
}

export function subscribeDashboardRealtimeEvent(listener: DashboardRealtimeListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function shouldReceiveDashboardRealtimeEvent(
  user: { id: string; role: UserRole },
  event: DashboardRealtimeEvent
) {
  // DEVELOPER видит всё, как и в остальных read-слоях платформы. Раньше он
  // проваливался в ученическую ветку и не получал почти ничего.
  if (user.role === UserRole.TEACHER || user.role === UserRole.DEVELOPER) {
    return true;
  }

  if (event.kind === "students-changed") {
    return false;
  }

  if (event.kind === "topic-content-changed") {
    return true;
  }

  return event.studentId === user.id;
}
