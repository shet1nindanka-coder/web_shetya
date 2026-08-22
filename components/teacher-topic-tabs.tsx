"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTabIndicator } from "@/lib/animation-hooks";

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

  const activeIndex = Math.max(0, items.findIndex((item) => item.isActive));
  const { shellRef, indicatorProps } = useTabIndicator<HTMLElement>(activeIndex);

  return (
    <nav ref={shellRef} className="shbz-seg ui-tab-shell--live" aria-label="Режимы темы">
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
