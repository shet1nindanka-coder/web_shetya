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
    <div className="soft-grid min-h-screen">
      <DashboardNav user={user} />
      <main className="content-shell mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[40px] border border-white/40 bg-white/15 p-1.5 shadow-[0_16px_48px_rgba(15,23,42,0.04)] backdrop-blur-[2px]">
          <div className="rounded-[36px] bg-transparent px-0 py-1">{children}</div>
        </div>
      </main>
    </div>
  );
}
