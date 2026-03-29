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
    <nav className="ui-fade-slide mb-8 flex flex-wrap gap-2 rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)] backdrop-blur">
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
              "ui-pressable rounded-full border px-5 py-2.5 text-sm font-medium transition",
              isActive
                ? "border-brand-200 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.92))] text-brand-700 shadow-[0_12px_24px_rgba(59,130,246,0.14)]"
                : "border-slate-200/90 bg-white/92 text-slate-700 hover:border-brand-300 hover:text-brand-700"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
