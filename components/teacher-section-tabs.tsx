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
    <nav className="ui-fade-slide ui-tab-shell ui-tab-strip mb-4 flex gap-1 rounded-[12px] p-1 sm:mb-6 sm:gap-1.5 sm:rounded-[16px] sm:p-1.5">
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
            className={cx("ui-pressable ui-tab shrink-0 scroll-snap-align-start rounded-[10px] px-3 py-2 text-[0.8rem] font-medium sm:rounded-[12px] sm:px-4 sm:py-2.5 sm:text-sm")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
