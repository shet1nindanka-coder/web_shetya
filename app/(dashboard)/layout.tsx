import type { ReactNode } from "react";
import { UserRole } from "@prisma/client";
import { DashboardRealtimeListener } from "@/components/dashboard-realtime-listener";
import { Suspense } from "react";
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
    <div
      className="min-h-screen antialiased"
      style={{
        color: "var(--shbz-text-strong)",
        background: "var(--shbz-page-bg)",
        backgroundImage: "radial-gradient(640px 320px at 100% 0%, rgba(54, 224, 164, 0.07), rgba(90, 200, 234, 0) 70%)"
      }}
    >
      <StudentStreakProvider role={user.role} initialStreak={studentStreak}>
        <DashboardRealtimeListener userId={user.id} role={user.role} />
        {/* useSearchParams в шапке требует Suspense-границу при пререндере. */}
        <Suspense fallback={null}>
          <DashboardNav user={user} />
        </Suspense>
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-8 sm:pb-[72px]">
          {children}
        </main>
      </StudentStreakProvider>
    </div>
  );
}
