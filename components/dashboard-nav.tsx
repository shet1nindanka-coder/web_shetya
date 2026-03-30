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
    <header className="app-topbar border-b border-white/70 bg-[rgba(248,251,255,0.96)] sm:sticky sm:top-0 sm:z-20">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950">
            <span className="app-logo-mark flex h-10 w-10 items-center justify-center rounded-[16px] bg-slate-950 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)] sm:h-11 sm:w-11 sm:rounded-[18px] sm:text-base">
              T
            </span>
            <p className="font-display text-base font-semibold leading-none sm:text-lg">TutorFlow</p>
          </Link>
          {items.length > 0 ? <nav className="flex flex-wrap gap-2" /> : null}
        </div>

        <div className="app-topbar-profile flex w-full flex-col gap-3 rounded-[20px] border border-slate-200/80 bg-white/96 px-4 py-3 shadow-[0_10px_20px_rgba(15,23,42,0.04)] sm:w-auto sm:flex-row sm:items-center sm:justify-between sm:rounded-[24px]">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-slate-900">{user.name}</p>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </span>
            </div>
            <p className="truncate text-xs text-slate-500 sm:text-sm">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-pressable w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 sm:w-auto"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
