import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { StudentTopicsList, type StudentTopicListItem } from "@/components/student-topics-list";
import { StudentTopicsRefreshBridge } from "@/components/student-topics-refresh-bridge";
import { requireUser } from "@/lib/auth";
import { getStudentTopicsOverview } from "@/lib/platform-data";

export default async function StudentTopicsPage() {
  const user = await requireUser(UserRole.STUDENT);
  const data = await getStudentTopicsOverview(user.id);

  const topics: StudentTopicListItem[] = data.topics.map((topic) => {
    const solvedCount = topic.greenCount + topic.yellowCount;
    const solvedPercent = topic.totalNumbers > 0 ? Math.round((solvedCount / topic.totalNumbers) * 100) : 0;
    const isCompleted = topic.totalNumbers > 0 && solvedCount === topic.totalNumbers;

    return {
      id: topic.id,
      title: topic.title,
      description: topic.description ?? null,
      solvedCount,
      totalNumbers: topic.totalNumbers,
      solvedPercent,
      isCompleted
    };
  });

  return (
    <div>
      <StudentTopicsRefreshBridge />

      <ShbzPageHeader kicker="Темы" title="Список тем" aside={<ShbzNumberSearch />} />

      {topics.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Темы пока не добавлены
          </p>
        </div>
      ) : (
        <StudentTopicsList topics={topics} />
      )}
    </div>
  );
}
