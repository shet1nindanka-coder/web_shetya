export const STUDENT_NOTIFICATIONS_REALTIME_EVENT = "tutorflow:student-notifications-changed";

export function notifyStudentNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STUDENT_NOTIFICATIONS_REALTIME_EVENT));
}
