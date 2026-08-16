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

    // Сброс в null и установка на следующем кадре: без снятия атрибута CSS не перезапустит
    // keyframes, если новое значение совпало с предыдущим (две прибавки подряд).
    setMotionState(null);

    let timeout = 0;
    const frame = window.requestAnimationFrame(() => {
      setMotionState(nextMotionState);
      timeout = window.setTimeout(() => {
        setMotionState(null);
      }, 900);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [currentStreak]);

  return motionState;
}
