"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
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
  const [numberQuery, setNumberQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    for (const item of items) {
      router.prefetch(item.href);
    }
  }, [router]);

  useEffect(() => {
    setFeedback(null);
  }, [pathname]);

  return (
    <div className="ui-fade-slide ui-tab-shell mb-4 rounded-[12px] p-1 sm:mb-6 sm:rounded-[10px] sm:p-1.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <nav className="ui-tab-strip flex min-w-0 gap-1 overflow-x-auto sm:gap-1.5" aria-label="Разделы преподавателя">
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
                  "ui-pressable ui-tab shrink-0 scroll-snap-align-start rounded-[10px] px-3 py-2 text-[0.8rem] font-medium sm:rounded-[12px] sm:px-4 sm:py-2.5 sm:text-sm"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form
          className="flex w-full flex-col gap-2 xl:w-auto xl:min-w-[320px]"
          onSubmit={(event) => {
            event.preventDefault();

            const nextNumber = Number(numberQuery.trim());

            if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
              setFeedback("Введите корректный номер.");
              return;
            }

            setFeedback(null);

            startTransition(async () => {
              try {
                const response = await fetch(`/api/teacher/topics/find-number?number=${encodeURIComponent(String(nextNumber))}`, {
                  method: "GET",
                  cache: "no-store"
                });
                const result = (await response.json().catch(() => null)) as
                  | { href?: string; error?: string }
                  | null;

                if (!response.ok || !result?.href) {
                  setFeedback(result?.error ?? "Не удалось найти тему по этому номеру.");
                  return;
                }

                router.push(result.href);
              } catch {
                setFeedback("Не удалось найти тему по этому номеру.");
              }
            });
          }}
        >
          <label className="relative block">
            <span className="sr-only">Найти номер</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-text-muted)]">
              <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="9" cy="9" r="5.75" />
                <path strokeLinecap="round" d="M13.5 13.5 17 17" />
              </svg>
            </span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={numberQuery}
              onChange={(event) => {
                setNumberQuery(event.target.value.replace(/[^\d]/g, ""));
                if (feedback) {
                  setFeedback(null);
                }
              }}
              placeholder={isPending ? "Ищем номер..." : "Найти номер"}
              className="ui-input w-full rounded-[12px] py-2.5 pl-10 pr-3 text-sm xl:min-w-[320px]"
              aria-describedby={feedback ? "teacher-number-search-feedback" : undefined}
              aria-label="Найти номер и открыть тему"
              disabled={isPending}
            />
          </label>
          {feedback ? (
            <p
              id="teacher-number-search-feedback"
              className="text-xs font-medium text-[var(--theme-danger-text)] xl:pl-1"
            >
              {feedback}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
