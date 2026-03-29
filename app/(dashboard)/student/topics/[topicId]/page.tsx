import Link from "next/link";
import { UserRole } from "@prisma/client";
import { FileResourceCard } from "@/components/file-resource-card";
import { StudentTopicStatusBoard } from "@/components/student-topic-status-board";
import { StudentTopicTabs } from "@/components/student-topic-tabs";
import { requireUser } from "@/lib/auth";
import { getStudentTopicDetail } from "@/lib/platform-data";
import { toIsoDateTimeString } from "@/lib/utils";

type StudentTopicPageProps = {
  params: Promise<{
    topicId: string;
  }>;
};

export default async function StudentTopicPage({ params }: StudentTopicPageProps) {
  const user = await requireUser(UserRole.STUDENT);
  const { topicId } = await params;
  const topic = await getStudentTopicDetail(user.id, topicId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/student/topics" className="text-sm font-semibold text-brand-700 transition hover:text-brand-900">
            ← Ко всем темам
          </Link>
          <h1 className="font-display mt-3 text-3xl font-semibold text-slate-950 sm:text-4xl">{topic.title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{topic.description}</p>
        </div>
      </div>

      <StudentTopicTabs
        hasTheoryFile={Boolean(topic.theoryFile)}
        hasHomeworkFile={Boolean(topic.homeworkFile)}
        numbersContent={
          <StudentTopicStatusBoard
            topicId={topic.id}
            totalNumbers={topic.totalNumbers}
            notesEnabled={topic.notesEnabled}
            deadlinesEnabled={topic.deadlinesEnabled}
            initialNumbers={topic.numbers.map((number: (typeof topic.numbers)[number]) => ({
              id: number.id,
              number: number.number,
              status: number.studentStatus?.status ?? null,
              note: number.studentStatus?.note ?? "",
              deadlineAt: toIsoDateTimeString(number.studentStatus?.deadlineAt ?? null),
              answerLatex: number.answerLatex
            }))}
          />
        }
        theoryContent={
          <FileResourceCard
            title="Теория"
            description="Откройте файл прямо в браузере или скачайте его себе на устройство."
            file={topic.theoryFile}
            previewSize="expanded"
          />
        }
        homeworkContent={
          <FileResourceCard
            title="Задания"
            description="Задания доступны в отдельном файле. При необходимости откройте или скачайте его."
            file={topic.homeworkFile}
            previewSize="expanded"
          />
        }
      />
    </div>
  );
}
