import { UserRole } from "@prisma/client";
import { FileResourceCard } from "@/components/file-resource-card";
import { PageHeader } from "@/components/page-header";
import { StudentTopicStatusBoard } from "@/components/student-topic-status-board";
import { StudentTopicTabs } from "@/components/student-topic-tabs";
import { requireUser } from "@/lib/auth";
import { getStudentTopicDetail } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type StudentTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
  searchParams: Promise<{
    homework?: string;
    number?: string;
  }>;
};

export default async function StudentTopicPage({ params, searchParams }: StudentTopicPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { topicId } = await params;
  const { homework, number: numberParam } = await searchParams;
  const initialNumber =
    typeof numberParam === "string" && Number.isInteger(Number(numberParam))
      ? Number(numberParam)
      : null;
  const topic = await getStudentTopicDetail(user.id, topicId);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        backHref="/student/topics"
        backLabel="← Ко всем темам"
        eyebrow="Тема"
        title={topic.title}
        description={topic.description}
      />

      <StudentTopicTabs
        hasTheoryFile={Boolean(topic.theoryFile)}
        hasHomeworkFile={Boolean(topic.homeworkFile)}
        numbersContent={
          <StudentTopicStatusBoard
            topicId={topic.id}
            totalNumbers={topic.totalNumbers}
            notesEnabled={topic.notesEnabled}
            deadlinesEnabled={topic.deadlinesEnabled}
            initialHomeworkFilterId={homework}
            initialNumber={initialNumber}
            initialNumbers={topic.numbers.map((number: (typeof topic.numbers)[number]) => ({
              id: number.id,
              number: number.number,
              status: number.studentStatus?.status ?? null,
              note: number.studentStatus?.note ?? "",
              deadlineAt: toIsoDateTimeString(number.studentStatus?.deadlineAt ?? null),
              conditionLatex: number.conditionLatex,
              answerLatex: number.answerLatex
            }))}
          />
        }
        theoryContent={
          <FileResourceCard
            title="Теория"
            file={topic.theoryFile}
            previewSize="expanded"
          />
        }
        homeworkContent={
          <FileResourceCard
            title="Задания"
            file={topic.homeworkFile}
            previewSize="expanded"
          />
        }
      />
    </div>
  );
}
