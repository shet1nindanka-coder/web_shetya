import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { StudentSingleNumberCard } from "@/components/student-single-number-card";
import { requireUser } from "@/lib/auth";
import { findTopicIdByNumber, getStudentNumberDetail } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type StudentNumberPageProps = {
  params: Promise<{
    number: string;
  }>;
};

export default async function StudentNumberPage({ params }: StudentNumberPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { number: numberParam } = await params;
  // Номер — строка как есть; поиск дальше идёт по нормализованному виду, поэтому
  // и /numbers/010203, и /numbers/10203 открывают одну и ту же карточку.
  const targetNumber = decodeURIComponent(numberParam).trim();

  if (!/^\d+$/.test(targetNumber)) {
    notFound();
  }

  const topicId = await findTopicIdByNumber(targetNumber);

  if (!topicId) {
    notFound();
  }

  let data;

  try {
    data = await getStudentNumberDetail(user.id, topicId, targetNumber);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/student/homeworks"
        backLabel="← К моим ДЗ"
        eyebrow={data.topic.title}
        aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />}
        title={`Номер ${data.number.number}`}
      />

      <StudentSingleNumberCard
        topicId={topicId}
        homeworkNumberId={data.number.id}
        number={data.number.number}
        conditionLatex={data.number.conditionLatex}
        initialStatus={data.number.studentStatus?.status ?? null}
        initialNote={data.number.studentStatus?.note ?? ""}
        deadlineAt={toIsoDateTimeString(data.number.studentStatus?.deadlineAt ?? null)}
        notesEnabled={data.notesEnabled}
      />
    </div>
  );
}
