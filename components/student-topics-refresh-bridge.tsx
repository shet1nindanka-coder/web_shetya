"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STUDENT_TOPICS_REFRESH_KEY = "shbz:student-topics-needs-refresh";

export function markStudentTopicsNeedsRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STUDENT_TOPICS_REFRESH_KEY, "1");
}

export function StudentTopicsRefreshBridge() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldRefresh = window.sessionStorage.getItem(STUDENT_TOPICS_REFRESH_KEY) === "1";

    if (!shouldRefresh) {
      return;
    }

    window.sessionStorage.removeItem(STUDENT_TOPICS_REFRESH_KEY);
    router.refresh();
  }, [router]);

  return null;
}
