"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";
import { StudentNotificationsBell } from "@/components/student-notifications-bell";
import { useStudentStreak } from "@/components/student-streak-provider";
import { useStreakMotion } from "@/components/use-streak-motion";

type DashboardNavProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
  studentStreak?: {
    currentStreak: number;
  } | null;
};

const studentItems = [
  { href: "/student", label: "обзор", match: (p: string) => p === "/student" },
  { href: "/student/homeworks", label: "дз", match: (p: string) => p.startsWith("/student/homeworks") },
  { href: "/student/deadlines", label: "дедлайны", match: (p: string) => p.startsWith("/student/deadlines") },
  { href: "/student/info", label: "общая инфа", match: (p: string) => p.startsWith("/student/info") },
  {
    href: "/student/settings",
    label: "настройки",
    match: (p: string) => p.startsWith("/student/settings") || p.startsWith("/student/account")
  }
];

const developerItems = [
  { href: "/teacher/topics", label: "темы", match: (p: string) => p.startsWith("/teacher/topics") },
  { href: "/teacher/statistics", label: "статистика", match: (p: string) => p.startsWith("/teacher/statistics") },
  {
    href: "/teacher/settings",
    label: "настройки",
    match: (p: string) => p.startsWith("/teacher/settings") || p.startsWith("/teacher/account")
  }
];

const teacherItems = [
  { href: "/teacher", label: "обзор", match: (p: string) => p === "/teacher" },
  { href: "/teacher/topics", label: "темы", match: (p: string) => p.startsWith("/teacher/topics") },
  { href: "/teacher/students", label: "ученики", match: (p: string) => p.startsWith("/teacher/students") },
  {
    href: "/teacher/settings",
    label: "настройки",
    match: (p: string) => p.startsWith("/teacher/settings") || p.startsWith("/teacher/account")
  }
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function StreakFlame({ days }: { days: number }) {
  const motionState = useStreakMotion(days);

  return (
    <span className="shbz-streak-flame flex items-center gap-[5px]" data-animate={motionState ?? undefined}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--shbz-streak-flame)" aria-hidden="true">
        <path d="M12 2c1 3-1.5 4.5-1.5 7A3.5 3.5 0 0 0 14 12c0-2 1.5-3 1.5-3 1 4 .5 5-.5 7a4 4 0 1 1-7-3.5C9.5 9 11 7 12 2z" />
      </svg>
      <span className="shbz-streak-count font-bold" style={{ color: "var(--shbz-streak-text)" }}>
        {days} дн.
      </span>
    </span>
  );
}

export function DashboardNav({ user, studentStreak }: DashboardNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isStudent = user.role === UserRole.STUDENT;
  const roleLabel = isStudent ? "Ученик" : user.role === UserRole.DEVELOPER ? "Разработчик" : "Преподаватель";
  const liveStreak = useStudentStreak();
  const streakValue = liveStreak?.streak ?? studentStreak;
  const items = isStudent ? studentItems : user.role === UserRole.DEVELOPER ? developerItems : teacherItems;

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <header className="shbz-topbar">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-7 gap-y-5 px-4 py-3.5 sm:px-8">
        {/* Логотип */}
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <span className="text-2xl font-black leading-none tracking-[-1.2px]" style={{ color: "var(--shbz-text-strong)" }}>
            ШБЗ
          </span>
          <span className="hidden h-[22px] w-px sm:block" style={{ background: "var(--shbz-divider)" }} />
          <span className="hidden text-[13px] font-semibold sm:block" style={{ color: "var(--shbz-text-soft)" }}>
            Школа Базовых Знаний
          </span>
        </Link>

        {/* Таббар */}
        {items.length > 0 ? (
          <nav className="shbz-tabbar order-3 mx-auto hidden w-auto md:inline-flex xl:order-none xl:mx-0" aria-label="Разделы">
            {items.map((item) => (
              <Link key={item.href} href={item.href} prefetch data-active={item.match(pathname)} className="shbz-tab">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {/* Профиль */}
        <div className="hidden shrink-0 items-center gap-3.5 md:flex">
          <div className="shbz-avatar">{initialsOf(user.name)}</div>
          <div className="leading-[1.3]">
            <div className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              {user.name}
            </div>
            <div className="mt-0.5 flex items-center gap-[5px] text-xs" style={{ color: "var(--shbz-text-soft)" }}>
              <span>{roleLabel}</span>
              {isStudent && streakValue ? (
                <>
                  <span style={{ color: "var(--shbz-divider)" }}>·</span>
                  <StreakFlame days={streakValue.currentStreak} />
                </>
              ) : null}
            </div>
          </div>
          {isStudent ? <StudentNotificationsBell /> : null}
          <form action={logoutAction}>
            <button type="submit" className="shbz-btn-outline">
              Выйти
            </button>
          </form>
        </div>

        {/* Мобильное меню */}
        <div className="flex items-center gap-2 md:hidden">
          {isStudent ? <StudentNotificationsBell /> : null}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px]"
          style={{ borderColor: "var(--shbz-outline-border)", color: "var(--shbz-text-strong)" }}
          aria-label="Меню"
          aria-expanded={mobileOpen}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {mobileOpen ? (
              <>
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </>
            ) : (
              <>
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </>
            )}
          </svg>
        </button>
        </div>
      </div>

      {mobileOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden" onClick={closeMobile} />
          <div
            className="absolute left-0 right-0 top-full z-40 border-b p-4 md:hidden"
            style={{ background: "var(--shbz-card-bg)", borderColor: "var(--shbz-header-border)" }}
          >
            {items.length > 0 ? (
              <nav className="mb-4 flex flex-col gap-1" aria-label="Разделы">
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={item.match(pathname)}
                    className="shbz-tab"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="flex items-center gap-3.5 border-t pt-4" style={{ borderColor: "var(--shbz-soft-border)" }}>
              <div className="shbz-avatar">{initialsOf(user.name)}</div>
              <div className="min-w-0 flex-1 leading-[1.3]">
                <div className="truncate text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {user.name}
                </div>
                <div className="mt-0.5 flex items-center gap-[5px] text-xs" style={{ color: "var(--shbz-text-soft)" }}>
                  <span>{roleLabel}</span>
                  {isStudent && streakValue ? (
                    <>
                      <span style={{ color: "var(--shbz-divider)" }}>·</span>
                      <StreakFlame days={streakValue.currentStreak} />
                    </>
                  ) : null}
                </div>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="shbz-btn-outline">
                  Выйти
                </button>
              </form>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
