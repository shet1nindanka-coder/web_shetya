import type { ReactNode } from "react";
import { StudentSectionTabs } from "@/components/student-section-tabs";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <StudentSectionTabs />
      {children}
    </div>
  );
}
