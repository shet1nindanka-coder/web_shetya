"use client";

import type { ReactNode } from "react";
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UserRole } from "@prisma/client";
import type { StudentStreak } from "@/lib/student-streak";
import { STUDENT_STREAK_REALTIME_EVENT } from "@/lib/student-streak-realtime";

type StudentStreakProviderProps = {
  role: UserRole;
  initialStreak: StudentStreak | null;
  children: ReactNode;
};

type StudentStreakContextValue = {
  streak: StudentStreak | null;
  setStreak: (nextStreak: StudentStreak) => void;
  refresh: () => void;
};

const StudentStreakContext = createContext<StudentStreakContextValue | null>(null);

export function StudentStreakProvider({
  role,
  initialStreak,
  children
}: StudentStreakProviderProps) {
  const [streak, setStreakState] = useState<StudentStreak | null>(initialStreak);
  const inFlightRef = useRef<AbortController | null>(null);
  const initialStreakRef = useRef(initialStreak);

  // Only re-seed local state when the SERVER prop genuinely changes (e.g. full
  // navigation). Comparing by current-streak value keeps optimistic client
  // updates from being clobbered by a re-render that ships an identical prop.
  useEffect(() => {
    const previous = initialStreakRef.current;
    const sameSnapshot =
      previous?.currentStreak === initialStreak?.currentStreak &&
      previous?.solvedToday === initialStreak?.solvedToday &&
      previous?.solvedThisWeek === initialStreak?.solvedThisWeek;

    if (sameSnapshot) {
      return;
    }

    initialStreakRef.current = initialStreak;
    setStreakState(initialStreak);
  }, [initialStreak]);

  const refresh = useCallback(() => {
    if (role !== UserRole.STUDENT) {
      return;
    }

    inFlightRef.current?.abort();
    const controller = new AbortController();
    inFlightRef.current = controller;

    fetch("/api/student/streak", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to refresh streak: ${response.status}`);
        }

        return (await response.json()) as { streak?: StudentStreak };
      })
      .then((payload) => {
        const nextStreak = payload.streak;

        if (!nextStreak) {
          return;
        }

        startTransition(() => {
          setStreakState(nextStreak);
        });
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to refresh student streak.", error);
        }
      });
  }, [role]);

  useEffect(() => {
    if (role !== UserRole.STUDENT) {
      return;
    }

    window.addEventListener(STUDENT_STREAK_REALTIME_EVENT, refresh);

    return () => {
      window.removeEventListener(STUDENT_STREAK_REALTIME_EVENT, refresh);
      inFlightRef.current?.abort();
    };
  }, [role, refresh]);

  const value = useMemo<StudentStreakContextValue>(
    () => ({
      streak,
      setStreak: (nextStreak) => {
        setStreakState(nextStreak);
      },
      refresh
    }),
    [refresh, streak]
  );

  return <StudentStreakContext.Provider value={value}>{children}</StudentStreakContext.Provider>;
}

export function useStudentStreak() {
  return useContext(StudentStreakContext);
}
