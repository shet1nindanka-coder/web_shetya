import { notFound } from "next/navigation";
import { LessonKind, UserRole } from "@prisma/client";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherHomeworkPlanCreateForm } from "@/components/teacher-homework-plan-create-form";
import { requireUser } from "@/lib/auth";
import { pickDominantTopicId } from "@/lib/homework-plan";
import { getGroupDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type HomeworkPlanNewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomeworkPlanNewPage({ searchParams }: HomeworkPlanNewPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const params = (await searchParams) ?? {};
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : "";
  const groupIdParam = typeof params.groupId === "string" ? params.groupId : "";
  const studentIdParam = typeof params.studentId === "string" ? params.studentId : "";

  const topics = await prisma.topic.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true }
  });

  let kicker = "Домашнее задание";
  let members: Array<{ id: string; name: string }> = [];
  let defaultTopicId: string | null = null;
  let defaultTitle = "";
  let groupId: string | null = null;
  let sourceLessonId: string | null = null;

  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, kind: LessonKind.LESSON },
      select: {
        id: true,
        title: true,
        groupId: true,
        group: { select: { name: true } },
        participants: {
          orderBy: { student: { name: "asc" } },
          select: {
            studentId: true,
            student: { select: { name: true } },
            items: { select: { homeworkNumber: { select: { topicId: true } } } }
          }
        }
      }
    });

    if (!lesson) {
      notFound();
    }

    kicker = `По итогам занятия «${lesson.title}»`;
    members = lesson.participants.map((participant) => ({
      id: participant.studentId,
      name: participant.student.name
    }));

    // Вход со страницы ученика: ДЗ по итогам занятия только ему, не всей группе.
    if (studentIdParam) {
      members = members.filter((member) => member.id === studentIdParam);

      if (members.length === 0) {
        notFound();
      }
    }
    defaultTopicId = pickDominantTopicId(
      lesson.participants.flatMap((participant) =>
        participant.items.map((item) => ({ topicId: item.homeworkNumber.topicId }))
      )
    );
    defaultTitle = `ДЗ по итогам «${lesson.title}»`;
    groupId = lesson.groupId;
    sourceLessonId = lesson.id;
  } else if (groupIdParam) {
    const group = await getGroupDetail(groupIdParam);

    if (!group) {
      notFound();
    }

    kicker = group.name;
    members = group.members.map((member) => ({ id: member.id, name: member.name }));
    groupId = group.id;
  } else if (studentIdParam) {
    const student = await prisma.user.findFirst({
      where: { id: studentIdParam, role: UserRole.STUDENT },
      select: { id: true, name: true }
    });

    if (!student) {
      notFound();
    }

    kicker = student.name;
    members = [{ id: student.id, name: student.name }];
  } else {
    notFound();
  }

  if (members.length === 0) {
    return (
      <div>
        <ShbzPageHeader kicker={kicker} title="Новое ДЗ" />
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Некому выдавать: в группе нет учеников.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ShbzPageHeader kicker={kicker} title="Новое ДЗ" />
      <div className="shbz-card shbz-section-pad">
        <TeacherHomeworkPlanCreateForm
          prefix={prefix}
          topics={topics}
          members={members}
          defaultTopicId={defaultTopicId}
          defaultTitle={defaultTitle}
          groupId={groupId}
          sourceLessonId={sourceLessonId}
        />
      </div>
    </div>
  );
}
