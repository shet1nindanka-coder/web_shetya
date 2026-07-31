"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { DeleteButton } from "@/components/delete-button";
import { LessonManualAdd, type LessonBankTopic } from "@/components/lesson-manual-add";
import { ResultToggle } from "@/components/lesson-result-toggle";

const POLL_INTERVAL_MS = 2500;

type StudentLessonItem = {
  id: string;
  homeworkNumberId: string;
  number: number;
  topicTitle: string;
  difficulty: number | null;
  isExtra: boolean;
  result: string | null;
};

type StudentLesson = {
  id: string;
  participantId: string;
  title: string;
  status: string;
  createdAtLabel: string;
  durationMinutes: number;
  groupName: string | null;
  planPending: boolean;
  planError: string | null;
  items: StudentLessonItem[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Запланирован",
  ACTIVE: "Идёт",
  FINISHED: "Завершён"
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="shrink-0 transition-transform duration-150"
      style={{ color: "var(--shbz-kicker)", transform: expanded ? "rotate(90deg)" : "none" }}
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Занятия ученика в кабинете учителя: итоги, правки набора и пересборка —
 * всё прямо здесь; страница урока нужна только для групповых занятий.
 */
export function TeacherStudentLessons({ lessons, bank }: { lessons: StudentLesson[]; bank: LessonBankTopic[] }) {
  const router = useRouter();
  const [localLessons, setLocalLessons] = useState(lessons);
  const [error, setError] = useState<string | null>(null);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);
  // Все занятия изначально свёрнуты — раскрываются кликом по шапке.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  // Селекты «Добавить номер» показываются только по явному клику — не загромождают карточку.
  const [manualAddIds, setManualAddIds] = useState<Set<string>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(
    () => new Set(lessons.filter((lesson) => lesson.planPending).map((lesson) => lesson.id))
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalLessons(lessons);
    setPendingIds(new Set(lessons.filter((lesson) => lesson.planPending).map((lesson) => lesson.id)));
  }, [lessons]);

  // Поллинг генерации: как на доске урока, пока есть незавершённые пересборки.
  useEffect(() => {
    if (pendingIds.size === 0) {
      return;
    }

    const timer = setInterval(async () => {
      for (const lessonId of pendingIds) {
        const lesson = lessons.find((entry) => entry.id === lessonId);

        if (!lesson) {
          continue;
        }

        try {
          const response = await fetch(`/api/teacher/lessons/${lessonId}/status`, { cache: "no-store" });

          if (!response.ok) {
            continue;
          }

          const status = (await response.json()) as {
            participants: Array<{ participantId: string; planGeneratedAt: string | null; planError: string | null }>;
          };
          const participant = status.participants.find((entry) => entry.participantId === lesson.participantId);

          if (participant && (participant.planGeneratedAt || participant.planError)) {
            setPendingIds((current) => {
              const next = new Set(current);

              next.delete(lessonId);

              return next;
            });
            startTransition(() => router.refresh());
          }
        } catch {
          // Сеть мигнула — следующий тик попробует снова.
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [pendingIds, lessons, router]);

  const toggleSetEntry = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleExpanded = useCallback((lessonId: string) => toggleSetEntry(setExpandedIds, lessonId), []);
  const toggleManualAdd = useCallback((lessonId: string) => toggleSetEntry(setManualAddIds, lessonId), []);

  const setResult = useCallback(
    async (lessonId: string, participantId: string, itemId: string, result: string | null) => {
      // Оптимистично, как на доске урока: светофор подсвечивается сразу.
      setLocalLessons((current) =>
        current.map((lesson) =>
          lesson.id === lessonId
            ? { ...lesson, items: lesson.items.map((item) => (item.id === itemId ? { ...item, result } : item)) }
            : lesson
        )
      );
      setError(null);

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lessonId}/participants/${participantId}/items/${itemId}/result`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result })
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось сохранить итог.");
        }

        startTransition(() => router.refresh());
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить итог.");
        startTransition(() => router.refresh());
      }
    },
    [router]
  );

  const saveItems = useCallback(
    async (lesson: StudentLesson, homeworkNumberIds: string[], extraHomeworkNumberIds: string[]) => {
      setBusyLessonId(lesson.id);
      setError(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/participants/${lesson.participantId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeworkNumberIds, extraHomeworkNumberIds })
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось сохранить набор.");
        }

        startTransition(() => router.refresh());
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить набор.");
      } finally {
        setBusyLessonId(null);
      }
    },
    [router]
  );

  const regenerate = useCallback(async (lesson: StudentLesson) => {
    setBusyLessonId(lesson.id);
    setError(null);

    try {
      const response = await fetch(
        `/api/teacher/lessons/${lesson.id}/participants/${lesson.participantId}/regenerate`,
        { method: "POST" }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось запустить пересборку.");
      }

      setLocalLessons((current) =>
        current.map((entry) => (entry.id === lesson.id ? { ...entry, planPending: true, planError: null } : entry))
      );
      setPendingIds((current) => new Set(current).add(lesson.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось запустить пересборку.");
    } finally {
      setBusyLessonId(null);
    }
  }, []);

  if (localLessons.length === 0) {
    return (
      <div className="ui-panel-soft rounded-[16px] border-dashed px-5 py-10 text-center">
        <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Занятий пока не было</p>
        <p className="ui-copy-muted mt-2 text-sm">
          Составьте урок кнопкой «Составить урок (ИИ)» — его набор и итоги появятся здесь.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="shbz-notice-error px-4 py-3 text-sm font-medium" aria-live="polite">
          {error}
        </div>
      ) : null}

      {localLessons.map((lesson) => {
        const marked = lesson.items.filter((item) => item.result !== null).length;
        const expanded = expandedIds.has(lesson.id);
        const pending = pendingIds.has(lesson.id);
        const busy = busyLessonId === lesson.id;
        const mainItems = lesson.items.filter((item) => !item.isExtra);
        const extraItems = lesson.items.filter((item) => item.isExtra);
        const mainIds = mainItems.map((item) => item.homeworkNumberId);
        const extraIds = extraItems.map((item) => item.homeworkNumberId);
        const removeItem = (target: StudentLessonItem) =>
          void saveItems(
            lesson,
            mainIds.filter((id) => id !== target.homeworkNumberId),
            extraIds.filter((id) => id !== target.homeworkNumberId)
          );

        const renderItemRow = (item: StudentLessonItem) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[12px] px-3.5 py-2"
            style={
              item.isExtra
                ? { border: "1px dashed var(--shbz-input-border)" }
                : { background: "var(--shbz-soft-bg)" }
            }
          >
            <span className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              № {item.number}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
              {item.topicTitle}
              {item.difficulty ? ` · сложн. ${item.difficulty}` : ""}
            </span>
            <ResultToggle
              value={item.result}
              disabled={busy}
              onChange={(next) => void setResult(lesson.id, lesson.participantId, item.id, next)}
            />
            <span aria-hidden className="mx-1 h-5 w-px" style={{ background: "var(--shbz-soft-border)" }} />
            <button
              type="button"
              disabled={busy}
              aria-label={`Убрать № ${item.number} из набора`}
              title="Убрать из набора"
              onClick={() => removeItem(item)}
              className="transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: "var(--shbz-kicker)" }}
              onMouseEnter={(event) => {
                event.currentTarget.style.color = "var(--shbz-danger-text)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.color = "var(--shbz-kicker)";
              }}
            >
              <TrashIcon />
            </button>
          </li>
        );

        return (
          <article
            key={lesson.id}
            className="rounded-[16px] border px-5 py-4"
            style={{ borderColor: "var(--shbz-soft-border)" }}
          >
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              onClick={() => toggleExpanded(lesson.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleExpanded(lesson.id);
                }
              }}
              className="flex cursor-pointer select-none flex-wrap items-center gap-3"
            >
              <ChevronIcon expanded={expanded} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {lesson.title}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                  {lesson.createdAtLabel}
                  {lesson.groupName ? ` · ${lesson.groupName}` : ""} · {lesson.durationMinutes} мин ·{" "}
                  {statusLabels[lesson.status] ?? lesson.status}
                </p>
              </div>
              {lesson.items.length > 0 ? (
                <span
                  className={`shbz-chip ${marked === lesson.items.length ? "shbz-chip-green" : "shbz-chip-yellow"}`}
                >
                  итоги {marked} / {lesson.items.length}
                </span>
              ) : null}
            </div>

            {!expanded ? null : (
              <div className="mt-2">
                {pending ? (
                  <p
                    className="mt-2 inline-flex items-center gap-2.5 text-sm font-medium"
                    style={{ color: "var(--shbz-text-muted)" }}
                  >
                    <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
                    ИИ подбирает задания…
                  </p>
                ) : null}

                {lesson.planError && !pending ? (
                  <div className="shbz-notice-error mb-3 mt-2 px-4 py-3 text-sm">
                    {lesson.planError}{" "}
                    <button type="button" className="font-bold underline" onClick={() => void regenerate(lesson)}>
                      Повторить
                    </button>
                  </div>
                ) : null}

                {mainItems.length > 0 ? (
                  <>
                    <div className="mb-1.5 mt-2 flex flex-wrap items-baseline justify-between gap-2 px-3.5">
                      <span
                        className="text-[11px] font-bold uppercase tracking-[1.2px]"
                        style={{ color: "var(--shbz-kicker)" }}
                      >
                        Основная часть
                      </span>
                      <span className="text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                        Как решил на уроке?
                      </span>
                    </div>
                    <ol className="space-y-1.5">{mainItems.map(renderItemRow)}</ol>
                  </>
                ) : null}

                {extraItems.length > 0 ? (
                  <>
                    <div className="mb-1.5 mt-3.5 px-3.5">
                      <span
                        className="text-[11px] font-bold uppercase tracking-[1.2px]"
                        style={{ color: "var(--shbz-kicker)" }}
                      >
                        Дополнительно ⭐ — если успел
                      </span>
                    </div>
                    <ol className="space-y-1.5">{extraItems.map(renderItemRow)}</ol>
                  </>
                ) : null}

                {lesson.items.length === 0 && !pending ? (
                  <p className="mt-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                    Набор задач пуст — добавьте номера вручную или запустите пересборку.
                  </p>
                ) : null}

                <div
                  className="mt-4 flex flex-wrap items-center gap-2.5 border-t pt-3.5"
                  style={{ borderColor: "var(--shbz-soft-border)" }}
                >
                  <Link
                    href={`/teacher/homework-plans/new?lessonId=${lesson.id}`}
                    className="shbz-btn-outline inline-block no-underline"
                  >
                    Выдать ДЗ по итогам
                  </Link>
                  <a href={`/teacher/lessons/${lesson.id}/pdf`} className="shbz-btn-outline inline-block no-underline">
                    Скачать PDF
                  </a>
                  {lesson.groupName ? (
                    <Link
                      href={`/teacher/lessons/${lesson.id}`}
                      className="shbz-btn-outline inline-block no-underline"
                    >
                      Открыть урок
                    </Link>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleManualAdd(lesson.id)}
                      className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {manualAddIds.has(lesson.id) ? "Скрыть добавление" : "Добавить номер"}
                    </button>
                    <DeleteButton
                      variant="sm"
                      label="Пересобрать ИИ"
                      title="Пересобрать набор?"
                      description="Текущий набор задач и отмеченные итоги этого занятия будут заменены новым подбором ИИ. Это действие нельзя отменить."
                      confirmLabel="Пересобрать"
                      pendingLabel="Запускаем…"
                      disabled={busy || pending}
                      onConfirm={() => regenerate(lesson)}
                      onError={(confirmError) =>
                        setError(
                          confirmError instanceof Error ? confirmError.message : "Не удалось запустить пересборку."
                        )
                      }
                    />
                  </span>
                </div>

                {manualAddIds.has(lesson.id) ? (
                  <LessonManualAdd
                    bank={bank}
                    busy={busy}
                    existingIds={lesson.items.map((item) => item.homeworkNumberId)}
                    onAdd={(homeworkNumberId, toExtra) =>
                      void saveItems(
                        lesson,
                        toExtra ? mainIds : [...mainIds, homeworkNumberId],
                        toExtra ? [...extraIds, homeworkNumberId] : extraIds
                      )
                    }
                  />
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
