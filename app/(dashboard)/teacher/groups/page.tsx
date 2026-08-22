import Link from "next/link";
import { UserRole } from "@prisma/client";
import { GroupCreateForm } from "@/components/group-create-form";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getTeacherGroups } from "@/lib/platform-data";
import { formatShortDate } from "@/lib/utils";

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
  const groups = await getTeacherGroups(user);

  const noticeKey =
    typeof params.groupDeleted === "string"
      ? "deleted"
      : typeof params.groupError === "string" && params.groupError in groupNotices
        ? (params.groupError as keyof typeof groupNotices)
        : null;
  const notice = noticeKey ? groupNotices[noticeKey] : null;

  return (
    <div>
      <ShbzPageHeader kicker="Группы" title="Группы учеников" aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />} />

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

      {user.role === UserRole.DEVELOPER ? null : (
        <section>
          <h2 className="shbz-section-title">Создать группу</h2>
          <div className="shbz-card shbz-section-pad">
            <GroupCreateForm />
          </div>
        </section>
      )}

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
          <div className="ui-enter grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {groups.map((group) => (
              <article key={group.id} className="shbz-card shbz-card-hover p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                      {group.name}
                    </h3>
                    {/* Короткая дата без «г.» — иначе год уезжал на отдельную строку. */}
                    <p className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                      {group.grade ? `${group.grade} класс · ` : ""}создана {formatShortDate(group.createdAt)}
                    </p>
                  </div>
                  <span className="shbz-chip shbz-chip-green shrink-0">
                    {group.membersCount}{" "}
                    {group.membersCount === 1 ? "ученик" : group.membersCount < 5 ? "ученика" : "учеников"}
                  </span>
                </div>

                {/* Не перечисляем всех: первые три имени и «+N», чтобы карточка
                    не растягивалась у больших групп. */}
                {group.members.length > 0 ? (
                  <p className="mt-3 truncate text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                    {group.members
                      .slice(0, 3)
                      .map((member) => member.name)
                      .join(", ")}
                    {group.members.length > 3 ? ` и ещё ${group.members.length - 3}` : ""}
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
