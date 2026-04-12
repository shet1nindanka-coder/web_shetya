import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StudentSingleNumberCard } from "@/components/student-single-number-card";
import { requireUser } from "@/lib/auth";
import { getStudentNumberDetail } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type StudentNumberPageProps = {
  params: Promise<{
    topicId: string;
    number: string;
  }>;
};

export default async function StudentNumberPage({ params }: StudentNumberPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { topicId, number: numberParam } = await params;
  const targetNumber = Number(numberParam);

  if (!Number.isInteger(targetNumber) || targetNumber <= 0) {
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
        backHref={`/student/topics/${topicId}`}
        backLabel="← К теме"
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
