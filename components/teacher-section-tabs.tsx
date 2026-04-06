"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/lib/utils";

const items = [
  { href: "/teacher", label: "Обзор", match: (pathname: string) => pathname === "/teacher" },
  {
    href: "/teacher/topics",
    label: "Темы",
    match: (pathname: string) => pathname === "/teacher/topics" || pathname.startsWith("/teacher/topics/")
  },
  {
    href: "/teacher/students",
    label: "Ученики",
    match: (pathname: string) => pathname === "/teacher/students" || pathname.startsWith("/teacher/students/")
  },
  {
    href: "/teacher/statistics",
    label: "Статистика",
    match: (pathname: string) => pathname === "/teacher/statistics" || pathname.startsWith("/teacher/statistics/")
  },
  {
    href: "/teacher/settings",
    label: "Настройки",
    match: (pathname: string) =>
      pathname === "/teacher/settings" ||
      pathname.startsWith("/teacher/settings/") ||
      pathname === "/teacher/account" ||
      pathname.startsWith("/teacher/account/")
  }
];

export function TeacherSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of items) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <nav className="ui-fade-slide ui-tab-shell ui-tab-strip mb-6 flex gap-1.5 rounded-[20px] p-1.5 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:rounded-[22px] sm:p-2">
      {items.map((item) => {
        const isActive = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onMouseEnter={() => router.prefetch(item.href)}
            onFocus={() => router.prefetch(item.href)}
            data-active={isActive}
            className={cx("ui-pressable ui-tab shrink-0 rounded-[14px] px-4 py-2.5 text-sm font-medium sm:px-4.5")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
