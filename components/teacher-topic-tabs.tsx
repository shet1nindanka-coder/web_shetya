"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TeacherTopicTabsProps = {
  topicId: string;
};

export function TeacherTopicTabs({ topicId }: TeacherTopicTabsProps) {
  const pathname = usePathname();
  const prefix = pathname.startsWith("/developer") ? "/developer" : "/teacher";
  const base = `${prefix}/topics/${topicId}`;

  const items = [
    { href: base, label: "Просмотр", isActive: !pathname.startsWith(`${base}/edit`) },
    { href: `${base}/edit`, label: "Редактирование", isActive: pathname.startsWith(`${base}/edit`) }
  ];

  return (
    <nav className="shbz-seg" aria-label="Режимы темы">
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
