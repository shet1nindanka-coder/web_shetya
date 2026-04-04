import type { ReactNode } from "react";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireUser();

  return (
    <div className="app-dashboard-shell soft-grid min-h-screen">
      <DashboardNav user={user} />
      <main className="content-shell mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <div className="app-dashboard-frame rounded-[28px] border border-white/40 bg-white/16 p-1 shadow-[0_12px_32px_rgba(15,23,42,0.03)] sm:rounded-[40px] sm:p-1.5">
          <div className="app-dashboard-inner rounded-[24px] bg-transparent px-0 py-1 sm:rounded-[36px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
