"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTabIndicator } from "@/lib/animation-hooks";

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

  // A02: активная подложка — отдельный элемент, переезжает между вкладками.
  const activeIndex = Math.max(0, items.findIndex((item) => item.isActive));
  const { shellRef, indicatorProps } = useTabIndicator<HTMLElement>(activeIndex);

  return (
    <nav ref={shellRef} className="shbz-seg ui-tab-shell--live" aria-label="Разделы ученика">
      <span className="ui-tab-indicator" {...indicatorProps} />
      {items.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          data-tab-index={index}
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
