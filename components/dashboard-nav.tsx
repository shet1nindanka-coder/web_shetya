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
    <header className="sticky top-0 z-20 border-b border-white/60 bg-[rgba(246,251,255,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
              T
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none">TutorFlow</p>
              <p className="text-sm text-slate-500">Учебная платформа для репетитора</p>
            </div>
          </Link>
          {items.length > 0 ? <nav className="flex flex-wrap gap-2" /> : null}
        </div>

        <div className="flex flex-col items-start gap-3 rounded-[24px] border border-white/80 bg-white/85 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </span>
            </div>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:bg-slate-950 hover:text-white"
            >
              Выйти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
