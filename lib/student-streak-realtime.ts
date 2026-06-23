export const STUDENT_STREAK_REALTIME_EVENT = "tutorflow:student-streak-changed";

/**
 * Fire-and-forget signal that the student's streak might have changed and needs
 * to be re-fetched from the server. Safe to call from any client component
 * after a status mutation; the StudentStreakProvider listens for this event
 * and refreshes its snapshot via /api/student/streak.
 */
export function notifyStudentStreakChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STUDENT_STREAK_REALTIME_EVENT));
}
