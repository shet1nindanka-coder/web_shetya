import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
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

  const group = groupId ? await getGroupDetail(groupId) : null;

  if (!group) {
    notFound();
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
      <ShbzPageHeader kicker={group.name} title="Новый урок" />

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
        <TeacherLessonCreateForm
          prefix={prefix}
          groupId={group.id}
          members={group.members.map((member) => ({ id: member.id, name: member.name, speed: member.speed }))}
          topics={topics}
        />
      </div>
    </div>
  );
}
