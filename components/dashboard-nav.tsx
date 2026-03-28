import Link from "next/link";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/actions/auth";
import { Badge } from "@/components/badge";
import { cx } from "@/lib/utils";

type DashboardNavProps = {
  user: {
    name: string;
    email: string;
    role: UserRole;
  };
};

const navigation = {
  [UserRole.STUDENT]: [
    { href: "/dashboard", label: "Обзор" },
    { href: "/student", label: "Кабинет ученика" }
  ],
  [UserRole.TEACHER]: [
    { href: "/dashboard", label: "Обзор" },
    { href: "/teacher", label: "Кабинет преподавателя" }
  ]
};

export function DashboardNav({ user }: DashboardNavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/60 bg-[rgba(246,251,255,0.82)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-3 text-slate-950">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-lg font-semibold text-white">
              T
            </span>
            <div>
              <p className="font-display text-lg font-semibold leading-none">TutorFlow MVP</p>
              <p className="text-sm text-slate-500">Учебная платформа для репетитора</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {navigation[user.role].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col items-start gap-3 rounded-[24px] border border-white/80 bg-white/80 px-5 py-4 shadow-sm sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <p className="font-semibold text-slate-900">{user.name}</p>
              <Badge className="border-brand-200 bg-brand-50 text-brand-700">
                {user.role === UserRole.TEACHER ? "Преподаватель" : "Ученик"}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">{user.email}</p>
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
