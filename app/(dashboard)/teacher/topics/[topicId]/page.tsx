import { UserRole } from "@prisma/client";
import { deleteTopicAction } from "@/actions/topic";
import { DeleteButton } from "@/components/delete-button";
import { FileResourceCard } from "@/components/file-resource-card";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { TeacherTopicTabs } from "@/components/teacher-topic-tabs";
import { TeacherTopicViewNumbers } from "@/components/teacher-topic-view-numbers";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicDetail } from "@/lib/platform-data";

type TeacherTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
};

export default async function TeacherTopicPage({ params }: TeacherTopicPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const isDeveloper = user.role === UserRole.DEVELOPER;
  const { topicId } = await params;
  const data = await getTeacherTopicDetail(topicId);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/teacher/topics"
        backLabel="← Ко всем темам"
        eyebrow="Тема"
        title={data.topic.title}
        description={data.topic.description}
        actions={
          isDeveloper ? (
            <DeleteButton
              label="Удалить тему"
              title="Удалить тему?"
              description={
                <>
                  Тема <span className="font-semibold">«{data.topic.title}»</span> будет удалена вместе с
                  прикреплёнными файлами и статусами по номерам. Это действие нельзя отменить.
                </>
              }
              action={deleteTopicAction}
              fields={{ topicId: data.topic.id }}
            />
          ) : undefined
        }
      />

      {isDeveloper ? <TeacherTopicTabs topicId={data.topic.id} /> : null}

      <SectionCard title="Материалы" description="Файлы теории и заданий — так их видит ученик.">
        <div className="grid gap-4 xl:grid-cols-2">
          <FileResourceCard title="Теория" file={data.topic.theoryFile} />
          <FileResourceCard title="Задания" file={data.topic.homeworkFile} />
        </div>
      </SectionCard>

      <SectionCard title="Номера и ответы" description="Условия и ответы к номерам темы.">
        <TeacherTopicViewNumbers
          numbers={data.topic.homeworkNumbers.map((number) => ({
            id: number.id,
            number: number.number,
            conditionLatex: number.conditionLatex,
            answerLatex: number.answerLatex
          }))}
        />
      </SectionCard>
    </div>
  );
}
