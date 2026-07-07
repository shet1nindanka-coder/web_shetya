import { UserRole } from "@prisma/client";
import { DeleteTopicDialog } from "@/components/delete-topic-dialog";
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
  await requireUser(UserRole.TEACHER);
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
          <DeleteTopicDialog
            topicId={data.topic.id}
            topicTitle={data.topic.title}
            triggerLabel="Удалить тему"
            triggerClassName="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]"
          />
        }
      />

      <TeacherTopicTabs topicId={data.topic.id} />

      <SectionCard title="Материалы" description="Файлы теории и заданий — так их видит ученик.">
        <div className="grid gap-4 xl:grid-cols-2">
          <FileResourceCard title="Теория" file={data.topic.theoryFile} />
          <FileResourceCard title="Задания" file={data.topic.homeworkFile} />
        </div>
      </SectionCard>

      <SectionCard title="Номера и ответы" description="Условия и ответы к номерам темы.">
        <TeacherTopicViewNumbers
          topicId={data.topic.id}
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
