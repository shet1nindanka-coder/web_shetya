import Link from "next/link";
import { UserRole } from "@prisma/client";
import { createGroupAction } from "@/actions/group";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getTeacherGroups } from "@/lib/platform-data";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

type GroupsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const groupNotices = {
  deleted: { tone: "success", message: "Группа удалена. Ученики остались на платформе." },
  invalid: { tone: "error", message: "Проверьте название группы (до 120 символов) и класс (1–11)." },
  missing: { tone: "error", message: "Группа не найдена — возможно, её уже удалили." },
  save: { tone: "error", message: "Не удалось сохранить изменения. Применена ли миграция уроков и групп?" }
} as const;

export default async function TeacherGroupsPage({ searchParams }: GroupsPageProps) {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const params = (await searchParams) ?? {};
  const groups = await getTeacherGroups();

  const noticeKey =
    typeof params.groupDeleted === "string"
      ? "deleted"
      : typeof params.groupError === "string" && params.groupError in groupNotices
        ? (params.groupError as keyof typeof groupNotices)
        : null;
  const notice = noticeKey ? groupNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader kicker="Группы" title="Группы учеников" />

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
        <h2 className="shbz-section-title">Создать группу</h2>
        <div className="shbz-card shbz-section-pad">
          <form action={createGroupAction} className="flex flex-wrap items-end gap-4">
            <label className="block min-w-[240px] flex-1">
              <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Название
              </span>
              <input
                type="text"
                name="name"
                required
                maxLength={120}
                placeholder="Например: 9 класс, ОГЭ по субботам"
                className="shbz-input"
              />
            </label>
            <label className="block w-[130px]">
              <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Класс
              </span>
              <input type="number" name="grade" min={1} max={11} step={1} placeholder="—" className="shbz-input" />
            </label>
            <button type="submit" className="shbz-btn-primary px-[26px] py-[13px] text-[15px]">
              Создать группу
            </button>
          </form>
        </div>
      </section>

      <section className="mt-11">
        <h2 className="shbz-section-title">Текущие группы</h2>

        {groups.length === 0 ? (
          <div className="shbz-card px-6 py-10 text-center">
            <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Пока ни одной группы.
            </p>
            <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
              Создайте группу и добавьте в неё учеников — после этого можно составлять уроки с ИИ-подбором.
            </p>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {groups.map((group) => (
              <article key={group.id} className="shbz-card shbz-card-hover p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                      {group.name}
                    </h3>
                    <p className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                      {group.grade ? `${group.grade} класс · ` : ""}создана {formatDate(group.createdAt)}
                    </p>
                  </div>
                  <span className="shbz-chip shbz-chip-green shrink-0">
                    {group.membersCount}{" "}
                    {group.membersCount === 1 ? "ученик" : group.membersCount < 5 ? "ученика" : "учеников"}
                  </span>
                </div>

                {group.members.length > 0 ? (
                  <p className="mt-3 line-clamp-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                    {group.members.map((member) => member.name).join(", ")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                    Учеников пока нет.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link href={`${prefix}/groups/${group.id}`} className="shbz-btn-outline inline-block no-underline">
                    Открыть
                  </Link>
                  <Link
                    href={`${prefix}/lessons/new?groupId=${group.id}`}
                    className="shbz-btn-primary inline-block px-4 py-[10px] text-[13.5px] no-underline"
                  >
                    Составить урок
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
