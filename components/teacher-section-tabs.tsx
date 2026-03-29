"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav className="ui-fade-slide mb-8 flex flex-wrap gap-2 rounded-[28px] border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur">
      {items.map((item) => {
        const isActive = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cx(
              "ui-pressable rounded-full border px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-brand-200 bg-brand-50 text-brand-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:text-brand-700"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
