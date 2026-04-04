"use client";

import Link from "next/link";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";

type DashboardNavProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
};

const navigation = {
  [UserRole.STUDENT]: [],
  [UserRole.TEACHER]: []
};

export function DashboardNav({ user }: DashboardNavProps) {
  const items = navigation[user.role];

  return (
    <header className="app-topbar border-b sm:sticky sm:top-0 sm:z-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="app-brand-link inline-flex items-center gap-3 text-[var(--theme-text-strong)]">
            <span className="app-logo-mark flex h-10 w-10 items-center justify-center rounded-[16px] text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] sm:h-11 sm:w-11 sm:rounded-[18px] sm:text-base">
              T
            </span>
            <p className="app-brand-title font-display text-base font-semibold leading-none sm:text-lg">TutorFlow</p>
          </Link>
          {items.length > 0 ? <nav className="flex flex-wrap gap-2" /> : null}
        </div>

        <div className="app-topbar-profile ui-card-soft flex w-full flex-col gap-3 rounded-[20px] px-4 py-3 sm:w-auto sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px]">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-[var(--theme-text-strong)]">{user.name}</p>
              <span className="ui-badge-soft inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </span>
            </div>
            <p className="ui-copy-muted truncate text-xs sm:text-sm">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-pressable ui-button-secondary w-full rounded-full px-4 py-2 text-sm font-medium transition sm:w-auto"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
