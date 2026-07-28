import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { deleteGroupAction, renameGroupAction } from "@/actions/group";
import { DeleteButton } from "@/components/delete-button";
import { GroupMembersManager } from "@/components/group-members-manager";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getGroupDetail } from "@/lib/platform-data";

export const dynamic = "force-dynamic";

type GroupDetailPageProps = {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const groupNotices = {
  created: { tone: "success", message: "Группа создана. Добавьте в неё учеников." },
  saved: { tone: "success", message: "Группа сохранена." },
  invalid: { tone: "error", message: "Проверьте заполнение формы." },
  save: { tone: "error", message: "Не удалось сохранить изменения." }
} as const;

export default async function GroupDetailPage({ params, searchParams }: GroupDetailPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const { groupId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const group = await getGroupDetail(groupId);

  if (!group) {
    notFound();
  }

  const noticeKey =
    typeof resolvedSearchParams.groupCreated === "string"
      ? "created"
      : typeof resolvedSearchParams.groupSaved === "string"
        ? "saved"
        : typeof resolvedSearchParams.groupError === "string" && resolvedSearchParams.groupError in groupNotices
            ? (resolvedSearchParams.groupError as keyof typeof groupNotices)
            : null;
  const notice = noticeKey ? groupNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader
        kicker="Группа"
        title={group.name}
        aside={
          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`${prefix}/homework-plans/new?groupId=${group.id}`}
              className="shbz-btn-outline inline-block no-underline"
            >
              Выдать ДЗ группе
            </Link>
            <Link
              href={`${prefix}/lessons/new?groupId=${group.id}`}
              className="shbz-btn-primary inline-block px-[26px] py-[13px] text-[15px] no-underline"
            >
              Составить урок
            </Link>
          </div>
        }
      />

      {notice ? (
        <div
          className={
            notice.tone === "success"
              ? "shbz-notice-success mb-8 px-5 py-4 text-sm font-medium"
              : "shbz-notice-error mb-8 px-5 py-4 text-sm font-medium"
          }
          aria-live="polite"
        >
          {notice.message}
        </div>
      ) : null}

      <section>
        <h2 className="shbz-section-title">Участники</h2>
        <div className="shbz-card shbz-section-pad">
          <GroupMembersManager
            groupId={group.id}
            members={group.members.map((member) => ({
              id: member.id,
              name: member.name,
              email: member.email,
              speed: member.speed,
              aiNote: member.aiNote,
              progress: member.progress
            }))}
            allStudents={group.allStudents}
          />
        </div>
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Настройки группы</h2>
        <div className="shbz-card shbz-section-pad">
          <form action={renameGroupAction} className="flex flex-wrap items-end gap-4">
            <input type="hidden" name="groupId" value={group.id} />
            <label className="block min-w-[240px] flex-1">
              <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Название группы
              </span>
              <input type="text" name="name" required maxLength={120} defaultValue={group.name} className="shbz-input" />
            </label>
            <button type="submit" className="shbz-btn-outline">
              Переименовать
            </button>
          </form>

          <div className="mt-6">
            <DeleteButton
              label="Удалить группу"
              title="Удалить группу?"
              description={
                <>
                  Группа <span className="font-semibold">«{group.name}»</span> будет удалена. Ученики и их
                  прогресс не удаляются — они просто перестанут состоять в группе.
                </>
              }
              action={deleteGroupAction}
              fields={{ groupId: group.id }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
