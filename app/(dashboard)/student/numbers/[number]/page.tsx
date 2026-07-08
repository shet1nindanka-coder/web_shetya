import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
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
  const targetNumber = Number(numberParam);

  if (!Number.isInteger(targetNumber) || targetNumber <= 0) {
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
        title={`Номер ${data.number.number}`}
      />

      <StudentSingleNumberCard
        topicId={topicId}
        homeworkNumberId={data.number.id}
        number={data.number.number}
        conditionLatex={data.number.conditionLatex}
        answerLatex={data.number.answerLatex}
        initialStatus={data.number.studentStatus?.status ?? null}
        initialNote={data.number.studentStatus?.note ?? ""}
        deadlineAt={toIsoDateTimeString(data.number.studentStatus?.deadlineAt ?? null)}
        notesEnabled={data.notesEnabled}
      />
    </div>
  );
}
