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
    <header className="sticky top-0 z-20 border-b border-white/60 bg-[linear-gradient(180deg,rgba(248,251,255,0.95),rgba(244,248,255,0.78))] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950">
            <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#0f172a,#1d4ed8)] text-lg font-semibold text-white shadow-[0_14px_30px_rgba(29,78,216,0.22)]">
              T
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none">TutorFlow</p>
              <p className="text-sm text-slate-500">Платформа для тем, заданий и прогресса</p>
            </div>
          </Link>
          {items.length > 0 ? <nav className="flex flex-wrap gap-2" /> : null}
        </div>

        <div className="flex flex-col items-start gap-3 rounded-[28px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] px-5 py-4 shadow-[0_16px_38px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.88))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-sm">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </span>
            </div>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="ui-pressable rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:bg-slate-950 hover:text-white"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
