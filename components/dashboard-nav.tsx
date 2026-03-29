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
    <header className="sticky top-0 z-20 border-b border-white/70 bg-[rgba(248,251,255,0.9)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950">
            <span className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-slate-950 text-base font-semibold text-white shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
              T
            </span>
            <p className="font-display text-lg font-semibold leading-none">TutorFlow</p>
          </Link>
          {items.length > 0 ? <nav className="flex flex-wrap gap-2" /> : null}
        </div>

        <div className="flex flex-col items-start gap-3 rounded-[24px] border border-slate-200/80 bg-white/92 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </span>
            </div>
            <p className="hidden truncate text-sm text-slate-500 sm:block">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-pressable rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
