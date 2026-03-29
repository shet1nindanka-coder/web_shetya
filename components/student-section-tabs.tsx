"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cx } from "@/lib/utils";

const items = [
  { href: "/student", label: "Обзор", match: (pathname: string) => pathname === "/student" },
  {
    href: "/student/topics",
    label: "Темы",
    match: (pathname: string) => pathname === "/student/topics" || pathname.startsWith("/student/topics/")
  },
  {
    href: "/student/info",
    label: "Общая инфа",
    match: (pathname: string) => pathname === "/student/info" || pathname.startsWith("/student/info/")
  },
  {
    href: "/student/account",
    label: "Личный кабинет",
    match: (pathname: string) => pathname === "/student/account" || pathname.startsWith("/student/account/")
  }
];

export function StudentSectionTabs() {
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
