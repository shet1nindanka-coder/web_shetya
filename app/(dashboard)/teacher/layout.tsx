import type { ReactNode } from "react";
import { TeacherSectionTabs } from "@/components/teacher-section-tabs";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <TeacherSectionTabs />
      {children}
    </div>
  );
}
