import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherLessonCreateForm } from "@/components/teacher-lesson-create-form";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/platform-data";
import { prisma } from "@/lib/prisma";
import { getSiteSettingsUncached } from "@/lib/site-settings";
import { getAiCheckConfig } from "@/lib/solution-check";

export const dynamic = "force-dynamic";

type LessonNewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LessonNewPage({ searchParams }: LessonNewPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const params = (await searchParams) ?? {};
  const groupId = typeof params.groupId === "string" ? params.groupId : "";
  const studentIdParam = typeof params.studentId === "string" ? params.studentId : "";

  let kicker = "";
  let members: Array<{ id: string; name: string; speed: number | null }> = [];
  let formGroupId: string | undefined;

  if (groupId) {
    const group = await getGroupDetail(user, groupId);

    if (!group) {
      notFound();
    }

    kicker = group.name;
    members = group.members.map((member) => ({ id: member.id, name: member.name, speed: member.speed }));
    formGroupId = group.id;
  } else if (studentIdParam) {
    // Индивидуальный урок: один ученик, без группы.
    const student = await prisma.user.findFirst({
      where: { id: studentIdParam, role: UserRole.STUDENT },
      select: { id: true, name: true, studentProfile: { select: { speed: true } } }
    });

    if (!student) {
      notFound();
    }

    kicker = student.name;
    members = [{ id: student.id, name: student.name, speed: student.studentProfile?.speed ?? null }];
  } else {
    // Без параметров — выбор, кому составляется урок: группа или один ученик.
    const teacherScope = user.role === UserRole.TEACHER ? { teacherId: user.id } : {};
    const [groups, students] = await Promise.all([
      prisma.studentGroup.findMany({
        where: teacherScope,
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { members: true } } }
      }),
      prisma.user.findMany({
        where: { role: UserRole.STUDENT, ...teacherScope },
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      })
    ]);

    return (
      <div>
        <ShbzPageHeader
          kicker="Занятия"
          title="Новый урок"
          aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
        />

        <div className="space-y-9">
          <section>
            <h2 className="shbz-section-title">Для группы</h2>
            {groups.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Групп пока нет — создайте её в разделе «группы».
              </p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`${prefix}/lessons/new?groupId=${group.id}`}
                    className="shbz-btn-outline inline-block no-underline"
                  >
                    {group.name} · {group._count.members}
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="shbz-section-title">Для одного ученика</h2>
            {students.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Учеников пока нет — создайте аккаунт в разделе «ученики».
              </p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {students.map((student) => (
                  <Link
                    key={student.id}
                    href={`${prefix}/lessons/new?studentId=${student.id}`}
                    className="shbz-btn-outline inline-block no-underline"
                  >
                    {student.name}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  const [topics, settings] = await Promise.all([
    prisma.topic.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true }
    }),
    getSiteSettingsUncached()
  ]);

  const aiAvailable = Boolean(settings.aiEnabled && settings.lessonPlanEnabled && getAiCheckConfig(settings));

  return (
    <div>
      <ShbzPageHeader kicker={kicker} title="Новый урок" aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />} />

      {!aiAvailable ? (
        <div
          className="mb-8 rounded-[12px] border px-5 py-4 text-sm font-medium"
          style={{
            background: "var(--shbz-yellow-soft)",
            borderColor: "var(--shbz-yellow-text)",
            color: "var(--shbz-yellow-text)"
          }}
        >
          ИИ-подбор сейчас недоступен (модель выключена или не настроена). Урок создастся пустым — задания можно
          добавить вручную.
        </div>
      ) : null}

      <div className="shbz-card shbz-section-pad">
        <TeacherLessonCreateForm prefix={prefix} groupId={formGroupId} members={members} topics={topics} />
      </div>
    </div>
  );
}
