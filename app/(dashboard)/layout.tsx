import type { ReactNode } from "react";
import { DashboardRealtimeListener } from "@/components/dashboard-realtime-listener";
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
      <DashboardRealtimeListener userId={user.id} role={user.role} />
      <DashboardNav user={user} />
      <main className="content-shell mx-auto w-full max-w-[1360px] px-2 py-3 sm:px-4 sm:py-5 lg:px-6">
        <div className="app-dashboard-frame rounded-[16px] border border-white/30 bg-white/12 p-0.5 shadow-[0_4px_16px_rgba(15,23,42,0.02)] sm:rounded-[22px] sm:p-1">
          <div className="app-dashboard-inner rounded-[14px] bg-transparent px-0 py-0.5 sm:rounded-[20px] sm:py-1">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
