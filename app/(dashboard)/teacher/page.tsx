import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ShbzNavCard } from "@/components/shbz-nav-card";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getParentCallCounts } from "@/lib/parent-calls";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  const user = await requireUser(UserRole.TEACHER);
  const [data, callCounts] = await Promise.all([getTeacherTopicsOverview(user), getParentCallCounts(user)]);
  const callsDue = callCounts.due;
  const callsOverdue = callCounts.overdue;

  const cards = [
    {
      kicker: "Темы",
      title: "Материалы и ответы",
      href: "/teacher/topics",
      stats: [
        { label: "Темы", value: data.stats.totalTopics },
        { label: "Номера", value: data.stats.totalNumbers }
      ]
    },
    {
      kicker: "Ученики",
      title: "Аккаунты и прогресс",
      href: "/teacher/students",
      stats: [
        { label: "Ученики", value: data.stats.totalStudents },
        { label: "Файлы", value: data.stats.totalFiles }
      ]
    },
    {
      kicker: "Звонки",
      title: "Связь с родителями",
      href: "/teacher/calls",
      stats: [
        { label: "Пора позвонить", value: callsDue },
        { label: "Просрочено", value: callsOverdue }
      ]
    }
  ];

  return (
    <div>
      <ShbzPageHeader
        kicker="Обзор"
        title="Кабинет преподавателя"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {cards.map((card) => (
          <ShbzNavCard
            key={card.kicker}
            kicker={card.kicker}
            title={card.title}
            stats={card.stats}
            footer={
              <Link href={card.href} className="shbz-btn-primary px-[18px] py-2.5 text-[13px]">
                Перейти
              </Link>
            }
          />
        ))}
      </div>
    </div>
  );
}
