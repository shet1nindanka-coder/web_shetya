"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TeacherStudentTabsProps = {
  studentId: string;
};

export function TeacherStudentTabs({ studentId }: TeacherStudentTabsProps) {
  const pathname = usePathname();
  const base = `/teacher/students/${studentId}`;

  const items = [
    { href: base, label: "Проверка ДЗ", isActive: pathname === base },
    { href: `${base}/assign`, label: "Выдать ДЗ", isActive: pathname.startsWith(`${base}/assign`) }
  ];

  return (
    <div className="ui-tab-shell rounded-[12px] p-1 sm:rounded-[12px] sm:p-1.5">
      <nav className="ui-tab-strip flex min-w-0 gap-1 overflow-x-auto sm:gap-1.5" aria-label="Разделы ученика">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            data-active={item.isActive}
            className="ui-pressable ui-tab shrink-0 rounded-[12px] px-3 py-2 text-[0.8rem] font-medium sm:rounded-[12px] sm:px-4 sm:py-2.5 sm:text-sm"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
