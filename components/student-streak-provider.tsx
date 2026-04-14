"use client";

import type { ReactNode } from "react";
import { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState } from "react";
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
};

const StudentStreakContext = createContext<StudentStreakContextValue | null>(null);

export function StudentStreakProvider({
  role,
  initialStreak,
  children
}: StudentStreakProviderProps) {
  const [streak, setStreakState] = useState<StudentStreak | null>(initialStreak);
  const inFlightRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setStreakState(initialStreak);
  }, [initialStreak]);

  useEffect(() => {
    if (role !== UserRole.STUDENT) {
      return;
    }

    const handleRealtimeUpdate = () => {
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
    };

    window.addEventListener(STUDENT_STREAK_REALTIME_EVENT, handleRealtimeUpdate);

    return () => {
      window.removeEventListener(STUDENT_STREAK_REALTIME_EVENT, handleRealtimeUpdate);
      inFlightRef.current?.abort();
    };
  }, [role]);

  const value = useMemo<StudentStreakContextValue>(
    () => ({
      streak,
      setStreak: (nextStreak) => {
        setStreakState(nextStreak);
      }
    }),
    [streak]
  );

  return <StudentStreakContext.Provider value={value}>{children}</StudentStreakContext.Provider>;
}

export function useStudentStreak() {
  return useContext(StudentStreakContext);
}
