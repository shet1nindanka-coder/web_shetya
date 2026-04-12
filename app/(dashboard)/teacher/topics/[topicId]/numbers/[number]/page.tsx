import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { TeacherSingleNumberCard } from "@/components/teacher-single-number-card";
import { requireUser } from "@/lib/auth";
import { getTeacherNumberDetail } from "@/lib/platform-data";

type TeacherNumberPageProps = {
  params: Promise<{
    topicId: string;
    number: string;
  }>;
};

export default async function TeacherNumberPage({ params }: TeacherNumberPageProps) {
  await requireUser(UserRole.TEACHER);
  const { topicId, number: numberParam } = await params;
  const targetNumber = Number(numberParam);

  if (!Number.isInteger(targetNumber) || targetNumber <= 0) {
    notFound();
  }

  let data;

  try {
    data = await getTeacherNumberDetail(topicId, targetNumber);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref={`/teacher/topics/${topicId}#topic-answers`}
        backLabel="← К теме"
        eyebrow={data.topic.title}
        title={`Номер ${data.number.number}`}
      />

      <SectionCard title="Условие и ответ" description="Редактируйте LaTeX-условие и ответ для этого номера.">
        <TeacherSingleNumberCard
          topicId={topicId}
          homeworkNumberId={data.number.id}
          number={data.number.number}
          initialConditionLatex={data.number.conditionLatex}
          initialAnswerLatex={data.number.answerLatex}
        />
      </SectionCard>
    </div>
  );
}
