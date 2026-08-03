"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TeacherStudentTabsProps = {
  studentId: string;
};

export function TeacherStudentTabs({ studentId }: TeacherStudentTabsProps) {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/developer") ? "/developer" : "/teacher";
  const base = `${prefix}/students/${studentId}`;

  const items = [
    { href: base, label: "Проверка ДЗ", isActive: pathname === base },
    { href: `${base}/assign`, label: "Выдать ДЗ", isActive: pathname.startsWith(`${base}/assign`) },
    // «Занятия» — список проведённых, «Составить занятие» — сборка нового.
    // Порядок проверок важен: /lessons/new не должен подсвечивать список.
    {
      href: `${base}/lessons`,
      label: "Занятия",
      isActive: pathname === `${base}/lessons`
    },
    {
      href: `${base}/lessons/new`,
      label: "Составить занятие",
      isActive: pathname.startsWith(`${base}/lessons/new`)
    }
  ];

  return (
    <nav className="shbz-seg" aria-label="Разделы ученика">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          data-active={item.isActive}
          className="shbz-seg-btn shbz-seg-btn--plain"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
