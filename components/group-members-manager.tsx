"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addGroupMemberAction, removeGroupMemberAction } from "@/actions/group";
import { DeleteButton } from "@/components/delete-button";
import { GroupMemberEditor } from "@/components/group-member-editor";
import { cx } from "@/lib/utils";

type GroupMember = {
  id: string;
  name: string;
  email: string;
  speed: number | null;
  aiNote: string | null;
  progress: { greenCount: number; yellowCount: number; redCount: number };
};

type GroupCandidate = {
  id: string;
  name: string;
  email: string;
  groupId: string | null;
};

type GroupMembersManagerProps = {
  groupId: string;
  members: GroupMember[];
  allStudents: GroupCandidate[];
};

const MAX_SUGGESTIONS = 8;

/** Единый список участников: карточки со скоростью/заметкой, крестик убрать, поиск-добавление. */
export function GroupMembersManager({ groupId, members, allStudents }: GroupMembersManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const showFlash = (kind: "saved" | "error") => {
    setFlash(kind);

    if (flashTimer.current) {
      clearTimeout(flashTimer.current);
    }

    flashTimer.current = setTimeout(() => setFlash(null), 2000);
  };

  const memberIds = new Set(members.map((member) => member.id));
  const normalizedQuery = query.trim().toLowerCase();
  const suggestions = normalizedQuery
    ? allStudents
        .filter((student) => !memberIds.has(student.id) && student.name.toLowerCase().includes(normalizedQuery))
        .slice(0, MAX_SUGGESTIONS)
    : [];

  const mutate = (action: typeof addGroupMemberAction, studentId: string) => {
    const formData = new FormData();
    formData.set("groupId", groupId);
    formData.set("studentId", studentId);

    startTransition(async () => {
      const result = await action(formData);
      showFlash(result.ok ? "saved" : "error");

      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
          Участники · {members.length}
        </span>
        <span
          aria-live="polite"
          className="text-xs font-semibold"
          style={{
            color: flash === "error" ? "var(--shbz-danger-text)" : "var(--shbz-green-text)",
            opacity: isPending || flash ? 1 : 0,
            transition: "opacity 0.2s"
          }}
        >
          {isPending ? "Сохраняем…" : flash === "saved" ? "Сохранено" : flash === "error" ? "Ошибка" : ""}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="mb-3 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          В группе пока никого нет — найдите ученика в поле ниже.
        </p>
      ) : (
        <div className="mb-3 space-y-3.5">
          {members.map((member, index) => (
            <div
              key={member.id}
              className={cx("ui-fade-slide rounded-[16px] border px-5 py-4", `ui-stagger-${Math.min(index + 1, 6)}`)}
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
                <div className="flex items-center gap-2.5">
                  <span className="shbz-chip" style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}>
                    {member.progress.greenCount}
                  </span>
                  <span className="shbz-chip" style={{ background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" }}>
                    {member.progress.yellowCount}
                  </span>
                  <span className="shbz-chip" style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}>
                    {member.progress.redCount}
                  </span>
                  <DeleteButton
                    variant="icon"
                    ariaLabel={`Убрать ${member.name} из группы`}
                    title="Убрать из группы?"
                    description={
                      <>
                        <span className="font-semibold">«{member.name}»</span> перестанет состоять в группе.
                        Аккаунт и весь прогресс ученика сохранятся.
                      </>
                    }
                    confirmLabel="Да, убрать"
                    disabled={isPending}
                    onConfirm={() => mutate(removeGroupMemberAction, member.id)}
                  />
                </div>
              </div>
              <div className="mt-3.5">
                <GroupMemberEditor studentId={member.id} speed={member.speed} aiNote={member.aiNote} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={boxRef} className="relative max-w-xl">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          placeholder="+ Добавить ученика — начните вводить имя…"
          className="shbz-input"
          aria-label="Добавить ученика в группу"
        />

        {isDropdownOpen && normalizedQuery ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-52 overflow-y-auto rounded-[12px] border border-[var(--shbz-card-border)] bg-[var(--shbz-card-bg)] py-1 shadow-lg">
            {suggestions.length > 0 ? (
              suggestions.map((student) => {
                const inOtherGroup = Boolean(student.groupId) && student.groupId !== groupId;

                return (
                  <button
                    key={student.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setQuery("");
                      setIsDropdownOpen(false);
                      mutate(addGroupMemberAction, student.id);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-sm transition hover:bg-[var(--shbz-tab-hover)]"
                    style={{ color: "var(--theme-text-default)" }}
                  >
                    {student.name}
                    {inOtherGroup ? (
                      <span className="ml-2 text-xs" style={{ color: "var(--shbz-yellow-text)" }}>
                        в другой группе — будет переведён сюда
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3.5 py-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Никого не нашлось
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
