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
    <div className="min-h-screen">
      <DashboardNav user={user} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
