import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { deleteGroupAction, renameGroupAction, setGroupMembersAction } from "@/actions/group";
import { GroupMemberEditor } from "@/components/group-member-editor";
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
  members: { tone: "success", message: "Состав группы обновлён." },
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
        : typeof resolvedSearchParams.membersSaved === "string"
          ? "members"
          : typeof resolvedSearchParams.groupError === "string" && resolvedSearchParams.groupError in groupNotices
            ? (resolvedSearchParams.groupError as keyof typeof groupNotices)
            : null;
  const notice = noticeKey ? groupNotices[noticeKey] : null;

  const memberIds = new Set(group.members.map((member) => member.id));

  return (
    <div>
      <ShbzPageHeader
        kicker="Группа"
        title={group.name}
        aside={
          <Link
            href={`${prefix}/lessons/new?groupId=${group.id}`}
            className="shbz-btn-primary inline-block px-[26px] py-[13px] text-[15px] no-underline"
          >
            Составить урок
          </Link>
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
          {group.members.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
              В группе пока никого нет — отметьте учеников в блоке «Состав группы» ниже.
            </p>
          ) : (
            <div className="space-y-5">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-[16px] border px-5 py-4"
                  style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                        {member.name}
                      </p>
                      <p className="truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                        {member.email}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <span className="shbz-chip" style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}>
                        {member.progress.greenCount}
                      </span>
                      <span className="shbz-chip" style={{ background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" }}>
                        {member.progress.yellowCount}
                      </span>
                      <span className="shbz-chip" style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}>
                        {member.progress.redCount}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <GroupMemberEditor studentId={member.id} speed={member.speed} aiNote={member.aiNote} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Состав группы</h2>
        <div className="shbz-card shbz-section-pad">
          {group.allStudents.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
              На платформе пока нет учеников.
            </p>
          ) : (
            <form action={setGroupMembersAction}>
              <input type="hidden" name="groupId" value={group.id} />
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {group.allStudents.map((student) => {
                  const inOtherGroup = Boolean(student.groupId) && student.groupId !== group.id;

                  return (
                    <label
                      key={student.id}
                      className="flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm transition"
                      style={{ background: "var(--shbz-soft-bg)" }}
                    >
                      <input
                        type="checkbox"
                        name="memberIds"
                        value={student.id}
                        defaultChecked={memberIds.has(student.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                          {student.name}
                        </span>
                        {inOtherGroup ? (
                          <span className="block text-xs" style={{ color: "var(--shbz-yellow-text)" }}>
                            уже в другой группе — отметка переведёт сюда
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
              <button type="submit" className="shbz-btn-primary mt-5 px-[26px] py-[13px] text-[15px]">
                Сохранить состав
              </button>
            </form>
          )}
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

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--shbz-danger-text)" }}>
              Опасная зона
            </summary>
            <form action={deleteGroupAction} className="mt-3">
              <input type="hidden" name="groupId" value={group.id} />
              <button
                type="submit"
                className="ui-pressable ui-button-danger rounded-[12px] px-4 py-2.5 text-sm font-semibold transition"
              >
                Удалить группу
              </button>
              <p className="mt-2 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                Ученики и их прогресс не удаляются — они просто перестанут состоять в группе.
              </p>
            </form>
          </details>
        </div>
      </section>
    </div>
  );
}
