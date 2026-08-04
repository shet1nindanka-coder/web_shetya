import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
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
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const isDeveloper = user.role === UserRole.DEVELOPER;
  const { topicId, number: numberParam } = await params;
  // Номер — строка как есть; поиск идёт по нормализованному виду («010203» и «10203» —
  // одна карточка).
  const targetNumber = decodeURIComponent(numberParam).trim();

  if (!/^\d+$/.test(targetNumber)) {
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
        backHref={isDeveloper ? `/teacher/topics/${topicId}/edit#topic-answers` : `/teacher/topics/${topicId}`}
        backLabel="← К теме"
        eyebrow={data.topic.title}
        title={`Номер ${data.number.number}`}
      />

      {isDeveloper ? (
        <SectionCard title="Условие и ответ" description="Редактируйте LaTeX-условие и ответ для этого номера.">
          <TeacherSingleNumberCard
            topicId={topicId}
            homeworkNumberId={data.number.id}
            number={data.number.number}
            initialConditionLatex={data.number.conditionLatex}
            initialAnswerLatex={data.number.answerLatex}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Условие и ответ">
          {data.number.conditionLatex ? (
            <div>
              <p className="ui-form-label">Условие</p>
              <div className="mt-1.5">
                <LatexAnswerPreview value={data.number.conditionLatex} />
              </div>
            </div>
          ) : (
            <p className="ui-copy-muted text-sm">Условие не добавлено.</p>
          )}
          {data.number.answerLatex ? (
            <div className="mt-4">
              <p className="ui-form-label">Ответ</p>
              <div className="mt-1.5">
                <LatexAnswerPreview value={data.number.answerLatex} />
              </div>
            </div>
          ) : (
            <p className="ui-copy-muted mt-4 text-sm">Ответ не добавлен.</p>
          )}
        </SectionCard>
      )}
    </div>
  );
}
