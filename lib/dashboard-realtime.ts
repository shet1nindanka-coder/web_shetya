import { UserRole } from "@prisma/client";

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
    };

type DashboardRealtimeListener = (event: DashboardRealtimeEvent) => void;
type DashboardRealtimeEventInput = DashboardRealtimeEvent extends infer Event
  ? Event extends { occurredAt: string }
    ? Omit<Event, "occurredAt">
    : never
  : never;

declare global {
  var __dashboardRealtimeListeners__: Set<DashboardRealtimeListener> | undefined;
}

const listeners = global.__dashboardRealtimeListeners__ ?? new Set<DashboardRealtimeListener>();
global.__dashboardRealtimeListeners__ = listeners;

export function publishDashboardRealtimeEvent(event: DashboardRealtimeEventInput) {
  const payload = {
    ...event,
    occurredAt: new Date().toISOString()
  } as DashboardRealtimeEvent;

  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error("Dashboard realtime listener failed.", error);
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
  if (user.role === UserRole.TEACHER) {
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
