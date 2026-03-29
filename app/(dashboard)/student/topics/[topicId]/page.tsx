import Link from "next/link";
import { UserRole } from "@prisma/client";
import { FileResourceCard } from "@/components/file-resource-card";
import { StudentTopicStatusBoard } from "@/components/student-topic-status-board";
import { requireUser } from "@/lib/auth";
import { getStudentTopicDetail } from "@/lib/platform-data";

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
          <h1 className="font-display mt-3 text-4xl font-semibold text-slate-950">{topic.title}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{topic.description}</p>
        </div>
      </div>

      <StudentTopicStatusBoard
        topicId={topic.id}
        totalNumbers={topic.totalNumbers}
        initialNumbers={topic.numbers.map((number) => ({
          id: number.id,
          number: number.number,
          status: number.studentStatus?.status ?? null,
          answerLatex: number.answerLatex
        }))}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <FileResourceCard
          title="Теория"
          description="Откройте файл прямо в браузере или скачайте его себе на устройство."
          file={topic.theoryFile}
        />
        <FileResourceCard
          title="Задания"
          description="Задания доступны в отдельном файле. При необходимости откройте или скачайте его."
          file={topic.homeworkFile}
        />
      </div>
    </div>
  );
}
