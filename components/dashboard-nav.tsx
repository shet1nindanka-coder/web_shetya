"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";
import { StudentStreakBadge } from "@/components/student-streak-badge";
import { useStudentStreak } from "@/components/student-streak-provider";

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

export function DashboardNav({ user, studentStreak }: DashboardNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const roleLabel = user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик";
  const liveStreak = useStudentStreak();
  const streakValue = liveStreak?.streak ?? studentStreak;

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeMobile(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, closeMobile]);

  return (
    <header className="app-topbar border-b sm:sticky sm:top-0 sm:z-20">
      <div className="flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        {/* Logo */}
        <Link href="/" className="app-brand-link inline-flex items-center gap-2.5 text-[var(--theme-text-strong)]">
          <span className="app-logo-mark flex h-9 w-9 items-center justify-center rounded-[8px] text-sm font-semibold text-white sm:h-10 sm:w-10">
            T
          </span>
          <p className="app-brand-title font-display text-[0.95rem] font-semibold leading-none sm:text-base">TutorFlow</p>
        </Link>

        {/* Desktop profile */}
        <div className="app-topbar-profile hidden items-center gap-2 rounded-[8px] border px-3 py-2 sm:flex sm:rounded-[10px]">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--theme-text-strong)]">{user.name}</p>
            <div className="mt-0.75 flex flex-wrap items-center gap-2 text-xs text-[var(--theme-text-muted)]">
              {user.role === UserRole.STUDENT && streakValue ? (
                <StudentStreakBadge currentStreak={streakValue.currentStreak} />
              ) : null}
              <p className="truncate">{user.email}</p>
              <span className="text-[var(--theme-text-soft)]">•</span>
              <span className="whitespace-nowrap">{roleLabel}</span>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-pressable rounded-[10px] border border-[var(--theme-border-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--theme-text-muted)] transition hover:border-[var(--theme-border)] hover:text-[var(--theme-text-strong)]"
            >
              Выйти
            </button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[var(--theme-text-default)] transition hover:bg-[var(--theme-accent-soft)] sm:hidden"
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

      {/* Mobile dropdown */}
      {mobileOpen && (
        <>
          <div className="mobile-overlay fixed inset-0 z-30 bg-black/20 backdrop-blur-sm sm:hidden" onClick={closeMobile} />
          <div className="mobile-panel absolute left-0 right-0 top-full z-40 border-b border-[var(--theme-border)] bg-[var(--theme-header)] p-3 shadow-lg sm:hidden">
            <div className="rounded-[8px] border border-[var(--theme-border-soft)] bg-[var(--theme-surface)] p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--theme-accent-soft)] text-sm font-bold text-[var(--theme-accent-text)]">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--theme-text-strong)]">{user.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {user.role === UserRole.STUDENT && streakValue ? (
                      <StudentStreakBadge currentStreak={streakValue.currentStreak} />
                    ) : null}
                    <p className="truncate text-xs text-[var(--theme-text-muted)]">{user.email}</p>
                  </div>
                  <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-[var(--theme-text-soft)]">{roleLabel}</p>
                </div>
              </div>
              <div className="border-t border-[var(--theme-border-soft)] pt-3">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="ui-pressable ui-button-secondary w-full rounded-[10px] px-3 py-2 text-sm font-medium transition"
                  >
                    Выйти из аккаунта
                  </button>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
