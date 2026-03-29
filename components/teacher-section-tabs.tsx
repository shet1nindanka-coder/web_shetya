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
    <nav className="ui-fade-slide ui-tab-shell mb-8 flex flex-wrap gap-2 rounded-[28px] p-2.5">
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
            className={cx(
              "ui-pressable ui-tab rounded-full px-5 py-2.5 text-sm font-medium"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
