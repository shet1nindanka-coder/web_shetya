"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/lib/utils";

const items = [
  { href: "/teacher", label: "Обзор", match: (pathname: string) => pathname === "/teacher" },
  {
    href: "/teacher/statistics",
    label: "Статистика",
    match: (pathname: string) => pathname === "/teacher/statistics" || pathname.startsWith("/teacher/statistics/")
  },
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
    href: "/teacher/account",
    label: "Личный кабинет",
    match: (pathname: string) => pathname === "/teacher/account" || pathname.startsWith("/teacher/account/")
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
    <nav className="ui-fade-slide ui-tab-shell ui-tab-strip mb-6 flex gap-2 rounded-[24px] p-2 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:rounded-[28px] sm:p-2.5">
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
            className={cx("ui-pressable ui-tab shrink-0 rounded-full px-4 py-2.5 text-sm font-medium sm:px-5")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
