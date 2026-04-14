import type { ReactNode } from "react";
import { UserRole } from "@prisma/client";
import { DashboardRealtimeListener } from "@/components/dashboard-realtime-listener";
import { DashboardNav } from "@/components/dashboard-nav";
import { StudentStreakProvider } from "@/components/student-streak-provider";
import { requireUser } from "@/lib/auth";
import { getStudentStreakSnapshot } from "@/lib/student-streak";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const user = await requireUser();
  const studentStreak = user.role === UserRole.STUDENT ? await getStudentStreakSnapshot(user.id) : null;

  return (
    <div className="app-dashboard-shell soft-grid min-h-screen">
      <StudentStreakProvider role={user.role} initialStreak={studentStreak}>
        <DashboardRealtimeListener userId={user.id} role={user.role} />
        <DashboardNav user={user} studentStreak={studentStreak} />
        <main className="content-shell mx-auto w-full max-w-[1360px] px-2 py-3 sm:px-4 sm:py-5 lg:px-6">
          <div className="app-dashboard-frame">
            <div className="app-dashboard-inner">
              {children}
            </div>
          </div>
        </main>
      </StudentStreakProvider>
    </div>
  );
}
