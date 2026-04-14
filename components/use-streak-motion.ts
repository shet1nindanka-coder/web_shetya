"use client";

import { useEffect, useRef, useState } from "react";

export type StudentStreakMotionState = "ignite" | "grow" | "drop" | null;

export function useStreakMotion(currentStreak: number): StudentStreakMotionState {
  const previousStreakRef = useRef(currentStreak);
  const [motionState, setMotionState] = useState<StudentStreakMotionState>(null);

  useEffect(() => {
    const previousStreak = previousStreakRef.current;

    if (currentStreak === previousStreak) {
      return;
    }

    const nextMotionState: StudentStreakMotionState =
      previousStreak === 0 && currentStreak > 0 ? "ignite" : currentStreak > previousStreak ? "grow" : "drop";

    previousStreakRef.current = currentStreak;
    setMotionState(nextMotionState);

    const timeout = window.setTimeout(() => {
      setMotionState(null);
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentStreak]);

  return motionState;
}
