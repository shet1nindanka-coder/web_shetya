"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { StudentNotification } from "@/lib/notifications";
import { STUDENT_NOTIFICATIONS_REALTIME_EVENT } from "@/lib/student-notifications-realtime";

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "только что";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);

  if (sameDay) {
    return `сегодня, ${time}`;
  }

  return `${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" }).format(date)}, ${time}`;
}

export function StudentNotificationsBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/student/notifications", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        notifications?: StudentNotification[];
        unreadCount?: number;
      };

      setNotifications(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch {
      // сеть могла прерваться — показываем прошлые данные
    }
  }, []);

  useEffect(() => {
    void load();

    const onRealtime = () => {
      void load();
    };

    window.addEventListener(STUDENT_NOTIFICATIONS_REALTIME_EVENT, onRealtime);

    return () => {
      window.removeEventListener(STUDENT_NOTIFICATIONS_REALTIME_EVENT, onRealtime);
    };
  }, [load]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 16);
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);

    setMenuPosition({ top: rect.bottom + 10, left, width });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();
    void load();

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    const onReposition = () => updatePosition();

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, load, updatePosition]);

  const markAllRead = useCallback(async () => {
    setUnreadCount(0);
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, readAt: notification.readAt ?? new Date().toISOString() }))
    );

    try {
      await fetch("/api/student/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
    } catch {
      // не критично
    }
  }, []);

  const openNotification = useCallback(
    async (notification: StudentNotification) => {
      setIsOpen(false);

      if (!notification.readAt) {
        setUnreadCount((current) => Math.max(0, current - 1));
        setNotifications((current) =>
          current.map((entry) =>
            entry.id === notification.id ? { ...entry, readAt: new Date().toISOString() } : entry
          )
        );

        try {
          await fetch("/api/student/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notificationId: notification.id })
          });
        } catch {
          // не критично
        }
      }

      if (notification.href) {
        router.push(notification.href);
      }
    },
    [router]
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={unreadCount > 0 ? `Уведомления: ${unreadCount} непрочитанных` : "Уведомления"}
        aria-expanded={isOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] transition-colors"
        style={{
          borderColor: isOpen ? "var(--shbz-outline-hover)" : "var(--shbz-outline-border)",
          background: "var(--shbz-card-bg)",
          color: "var(--shbz-text-strong)"
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-extrabold text-white"
            style={{ background: "var(--shbz-danger-solid)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={panelRef}
              data-shbz-portal=""
              className="fixed overflow-hidden rounded-[16px] border"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 1000,
                background: "var(--shbz-card-bg)",
                borderColor: "var(--shbz-card-border)",
                boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.18)"
              }}
            >
              <div
                className="flex items-center justify-between gap-3 border-b px-4 py-3"
                style={{ borderColor: "var(--shbz-soft-border)" }}
              >
                <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  Уведомления
                </span>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-[12.5px] font-semibold"
                    style={{ color: "var(--shbz-accent-solid)" }}
                  >
                    Прочитать все
                  </button>
                ) : null}
              </div>

              <div className="max-h-[380px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                    Уведомлений нет
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      className="flex w-full items-start gap-2.5 border-b px-4 py-3 text-left transition-colors last:border-b-0"
                      style={{ borderColor: "var(--shbz-row-border)" }}
                      onMouseEnter={(event) => {
                        event.currentTarget.style.background = "var(--shbz-soft-bg)";
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: notification.readAt ? "transparent" : "var(--shbz-accent-solid)"
                        }}
                      />
                      <span className="min-w-0">
                        <span
                          className="block text-[13.5px] leading-snug"
                          style={{
                            color: "var(--shbz-text-strong)",
                            fontWeight: notification.readAt ? 600 : 800
                          }}
                        >
                          {notification.title}
                        </span>
                        {notification.body ? (
                          <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: "var(--shbz-text-muted)" }}>
                            {notification.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--shbz-kicker)" }}>
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
