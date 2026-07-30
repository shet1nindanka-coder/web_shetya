"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { ResultToggle } from "@/components/lesson-result-toggle";

type StudentLessonItem = {
  id: string;
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
  items: StudentLessonItem[];
};

const statusLabels: Record<string, string> = {
  PLANNED: "Запланирован",
  ACTIVE: "Идёт",
  FINISHED: "Завершён"
};

/** Занятия ученика в кабинете учителя: итоги отмечаются прямо здесь, без возврата на страницу урока. */
export function TeacherStudentLessons({ lessons }: { lessons: StudentLesson[] }) {
  const router = useRouter();
  const [localLessons, setLocalLessons] = useState(lessons);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

        return (
          <article
            key={lesson.id}
            className="rounded-[16px] border px-5 py-4"
            style={{ borderColor: "var(--shbz-soft-border)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {lesson.title}
                </h3>
                <p className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                  {lesson.createdAtLabel}
                  {lesson.groupName ? ` · ${lesson.groupName}` : ""} · {lesson.durationMinutes} мин ·{" "}
                  {statusLabels[lesson.status] ?? lesson.status}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {lesson.items.length > 0 ? (
                  <span
                    className={`shbz-chip ${marked === lesson.items.length ? "shbz-chip-green" : "shbz-chip-yellow"}`}
                  >
                    итоги {marked} / {lesson.items.length}
                  </span>
                ) : null}
                <Link href={`/teacher/lessons/${lesson.id}`} className="shbz-btn-outline inline-block no-underline">
                  Открыть урок
                </Link>
              </div>
            </div>

            {lesson.items.length > 0 ? (
              <ol className="mt-3.5 space-y-2">
                {lesson.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] px-3.5 py-2"
                    style={{ background: "var(--shbz-soft-bg)" }}
                  >
                    <span className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                      № {item.number}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                      {item.topicTitle}
                      {item.difficulty ? ` · сложн. ${item.difficulty}` : ""}
                      {item.isExtra ? " · доп. ⭐" : ""}
                    </span>
                    <ResultToggle
                      value={item.result}
                      disabled={false}
                      onChange={(next) => void setResult(lesson.id, lesson.participantId, item.id, next)}
                    />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Набор задач пуст.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
