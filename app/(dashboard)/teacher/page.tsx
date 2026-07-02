import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ShbzNavCard } from "@/components/shbz-nav-card";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";

export default async function TeacherPage() {
  await requireUser(UserRole.TEACHER);
  const data = await getTeacherTopicsOverview();

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
      kicker: "Статистика",
      title: "Разбор и аналитика",
      href: "/teacher/statistics",
      stats: [
        { label: "Темы", value: data.stats.totalTopics },
        { label: "Ученики", value: data.stats.totalStudents }
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
