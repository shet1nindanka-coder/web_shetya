"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
