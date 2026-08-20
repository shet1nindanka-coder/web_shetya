"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TeacherStudentTabsProps = {
  studentId: string;
  /** Счётчик активных ДЗ в подписи вкладки «Проверка ДЗ». */
  activeHomeworksCount?: number;
};

export function TeacherStudentTabs({ studentId, activeHomeworksCount }: TeacherStudentTabsProps) {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/developer") ? "/developer" : "/teacher";
  const base = `${prefix}/students/${studentId}`;

  const items = [
    {
      href: base,
      label: activeHomeworksCount ? `Проверка ДЗ · ${activeHomeworksCount}` : "Проверка ДЗ",
      isActive: pathname === base
    },
    { href: `${base}/assign`, label: "Выдать ДЗ", isActive: pathname.startsWith(`${base}/assign`) },
    // Отдельной вкладки «Составить занятие» нет: сборка нового урока живёт
    // внутри «Занятий» (карточка пустого занятия первой в списке).
    {
      href: `${base}/lessons`,
      label: "Занятия",
      isActive: pathname.startsWith(`${base}/lessons`)
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
          aria-current={item.isActive ? "page" : undefined}
          className="shbz-seg-btn shbz-seg-btn--plain"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
