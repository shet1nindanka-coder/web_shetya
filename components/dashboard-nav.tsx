"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { useState, useCallback, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";
import { StudentNotificationsBell } from "@/components/student-notifications-bell";

type DashboardNavProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
};

// Уроки и ДЗ-черновики живут в собственном разделе «занятия».
function isPlannerPath(pathname: string, prefix: string) {
  return pathname.startsWith(`${prefix}/lessons`) || pathname.startsWith(`${prefix}/homework-plans`);
}

/** Кружок с шестерёнкой — вход в настройки на десктопе и телефоне. */
function SettingsGearLink({ href, active }: { href: string; active: boolean }) {
  return (
    <Link
      href={href}
      prefetch
      aria-label="Настройки"
      aria-current={active ? "page" : undefined}
      data-active={active}
      className="shbz-icon-circle shrink-0"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01A1.7 1.7 0 0 0 20.91 10H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
      </svg>
    </Link>
  );
}

const studentItems = [
  { href: "/student", label: "обзор", match: (p: string, _sp: URLSearchParams) => p === "/student" },
  { href: "/student/homeworks", label: "дз", match: (p: string, _sp: URLSearchParams) => p.startsWith("/student/homeworks") },
  { href: "/student/deadlines", label: "дедлайны", match: (p: string, _sp: URLSearchParams) => p.startsWith("/student/deadlines") },
  { href: "/student/theory", label: "теория", match: (p: string, _sp: URLSearchParams) => p.startsWith("/student/theory") },
  {
    href: "/student/settings",
    label: "настройки",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/student/settings")
  }
];

const developerItems = [
  { href: "/developer/topics", label: "темы", match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/topics") },
  { href: "/developer/accounts", label: "аккаунты", match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/accounts") },
  { href: "/developer/calls", label: "звонки", match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/calls") },
  { href: "/developer/statistics", label: "статистика", match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/statistics") },
  { href: "/developer/panel", label: "дев-панель", match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/panel") },
  {
    href: "/developer/settings",
    label: "настройки",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/developer/settings")
  }
];

const teacherItems = [
  { href: "/teacher", label: "обзор", match: (p: string, _sp: URLSearchParams) => p === "/teacher" },
  { href: "/teacher/topics", label: "темы", match: (p: string, _sp: URLSearchParams) => p.startsWith("/teacher/topics") },
  {
    href: "/teacher/students",
    label: "ученики",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/teacher/students")
  },
  {
    href: "/teacher/groups",
    label: "группы",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/teacher/groups")
  },
  {
    // Раньше раздел был сиротой: групповое занятие после закрытия вкладки
    // было достижимо только по прямому URL.
    href: "/teacher/lessons",
    label: "занятия",
    match: (p: string, _sp: URLSearchParams) => isPlannerPath(p, "/teacher")
  },
  {
    href: "/teacher/calls",
    label: "звонки",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/teacher/calls")
  },
  {
    href: "/teacher/settings",
    label: "настройки",
    match: (p: string, _sp: URLSearchParams) => p.startsWith("/teacher/settings")
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

export function DashboardNav({ user }: DashboardNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isStudent = user.role === UserRole.STUDENT;
  const roleLabel = isStudent ? "Ученик" : user.role === UserRole.DEVELOPER ? "Разработчик" : "Преподаватель";
  const items = isStudent ? studentItems : user.role === UserRole.DEVELOPER ? developerItems : teacherItems;
  // «Настройки» живут в кружке с шестерёнкой (десктоп — у профиля, телефон —
  // рядом с колокольчиком и меню), освобождая слот в таббаре и мобильном списке.
  const settingsItem = items.find((item) => item.href.endsWith("/settings")) ?? null;
  const tabbarItems = items.filter((item) => item !== settingsItem);
  const settingsActive = settingsItem ? settingsItem.match(pathname, searchParams) : false;

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
        <Logo href="/" size={24} className="shrink-0" />

        {/* Таббар */}
        {tabbarItems.length > 0 ? (
          <nav className="shbz-tabbar order-3 mx-auto hidden w-auto md:inline-flex xl:order-none xl:mx-0" aria-label="Разделы">
            {tabbarItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                data-active={item.match(pathname, searchParams)}
                aria-current={item.match(pathname, searchParams) ? "page" : undefined}
                className="shbz-tab"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {/* Профиль */}
        <div className="hidden shrink-0 items-center gap-3.5 md:flex">
          {/* На xl таббар, профиль и колокольчик делят одну строку с лого:
              аватар и имя прячутся у всех ролей (решение владельца — аватар
              без имени смысла не несёт), чтобы таббар стоял по центру, а шапка
              влезала в контейнер 1180. Стрик ученика живёт только на главной. */}
          <div className="shbz-avatar xl:hidden">{initialsOf(user.name)}</div>
          <div className="leading-[1.3] xl:hidden">
            <div className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              {user.name}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-soft)" }}>
              {roleLabel}
            </div>
          </div>
          {isStudent ? <StudentNotificationsBell /> : <StudentNotificationsBell endpoint="/api/notifications" />}
          {settingsItem ? <SettingsGearLink href={settingsItem.href} active={settingsActive} /> : null}
          <form action={logoutAction}>
            <button type="submit" className="shbz-btn-outline">
              Выйти
            </button>
          </form>
        </div>

        {/* Мобильное меню */}
        <div className="flex items-center gap-2 md:hidden">
          {isStudent ? <StudentNotificationsBell /> : <StudentNotificationsBell endpoint="/api/notifications" />}
          {settingsItem ? <SettingsGearLink href={settingsItem.href} active={settingsActive} /> : null}
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
            {tabbarItems.length > 0 ? (
              <nav className="mb-4 flex flex-col gap-1" aria-label="Разделы">
                {tabbarItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={item.match(pathname, searchParams)}
                    aria-current={item.match(pathname, searchParams) ? "page" : undefined}
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
                <div className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-soft)" }}>
                  {roleLabel}
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
