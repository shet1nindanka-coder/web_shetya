"use client";

import { UserRole } from "@prisma/client";
import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type DashboardRealtimeListenerProps = {
  userId: string;
  role: UserRole;
};

type DashboardRealtimeEvent =
  | {
      kind: "connected";
      occurredAt: string;
    }
  | {
      kind: "students-changed" | "topic-content-changed";
      occurredAt: string;
      topicId?: string;
    }
  | {
      kind: "student-progress-changed";
      occurredAt: string;
      studentId: string;
      topicId?: string;
    };

function shouldRefresh(userId: string, role: UserRole, event: DashboardRealtimeEvent) {
  if (event.kind === "connected") {
    return false;
  }

  if (role === UserRole.TEACHER) {
    return true;
  }

  if (event.kind === "students-changed") {
    return false;
  }

  if (event.kind === "topic-content-changed") {
    return true;
  }

  if (event.kind !== "student-progress-changed") {
    return false;
  }

  return event.studentId === userId;
}

export function DashboardRealtimeListener({
  userId,
  role
}: DashboardRealtimeListenerProps) {
  const router = useRouter();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/realtime");

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        startTransition(() => {
          router.refresh();
        });
      }, 180);
    };

    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as DashboardRealtimeEvent;

        if (shouldRefresh(userId, role, event)) {
          scheduleRefresh();
        }
      } catch (error) {
        console.error("Failed to parse dashboard realtime event.", error);
      }
    };

    return () => {
      source.close();

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [role, router, userId]);

  return null;
}
