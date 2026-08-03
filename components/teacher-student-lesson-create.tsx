"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/*
 * Создание занятия прямо на вкладке ученика: два способа рядом, как у выдачи ДЗ.
 * «Собрать ИИ» ставит подбор в очередь, «Собрать вручную» создаёт пустой урок —
 * номера учитель добавит сам на доске занятия.
 *
 * Тонкие настройки (темы, целевая сложность, скорость) остались на /teacher/lessons/new:
 * здесь только то, без чего урок не создать.
 */

type TeacherStudentLessonCreateProps = {
  studentId: string;
  prefix: string;
  aiAvailable: boolean;
};

const BUTTON_PRIMARY =
  "ui-pressable ui-button-primary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_SECONDARY =
  "ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function TeacherStudentLessonCreate({ studentId, prefix, aiAvailable }: TeacherStudentLessonCreateProps) {
  const router = useRouter();
  const [duration, setDuration] = useState("60");
  const [teacherNote, setTeacherNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const create = (skipPlan: boolean) => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentIds: [studentId],
            durationMinutes: Number(duration) || 60,
            topicIds: [],
            targetDifficulty: null,
            teacherNote: skipPlan ? "" : teacherNote.trim(),
            skipPlan
          })
        });

        const result = (await response.json().catch(() => null)) as
          | { lessonId?: string; error?: string }
          | null;

        // 503 «ИИ недоступен» тоже возвращает lessonId — урок создан, соберём вручную.
        if (result?.lessonId) {
          router.push(`${prefix}/lessons/${result.lessonId}?studentId=${studentId}`);
          return;
        }

        setError(result?.error || "Не удалось создать занятие. Попробуйте ещё раз.");
      } catch {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <div className="ui-panel-soft space-y-3 rounded-[16px] p-3.5 sm:space-y-4 sm:p-4">
      <h3 className="text-base font-semibold text-[var(--theme-text-strong)] sm:text-lg">Новое занятие</h3>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <label className="block space-y-1.5">
          <span className="ui-form-label">Длительность, мин</span>
          <input
            type="number"
            min={15}
            max={240}
            step={5}
            value={duration}
            disabled={isPending}
            onChange={(event) => setDuration(event.target.value)}
            className="ui-input w-full rounded-[8px] px-3.5 py-2.5"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="ui-form-label">Заметка для ИИ — необязательно</span>
          <input
            type="text"
            maxLength={500}
            value={teacherNote}
            disabled={isPending}
            placeholder="На что сделать упор на этом занятии"
            onChange={(event) => setTeacherNote(event.target.value)}
            className="ui-input w-full rounded-[8px] px-3.5 py-2.5"
          />
        </label>
      </div>

      {error ? <div className="ui-notice-error">{error}</div> : null}

      {!aiAvailable ? (
        <div className="ui-notice-warning">
          ИИ-подбор сейчас недоступен — модель выключена или не настроена. Занятие создастся пустым, задания
          добавите вручную.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON_PRIMARY} disabled={isPending} onClick={() => create(false)}>
          {isPending ? "Создаём…" : "Собрать ИИ"}
        </button>
        <button type="button" className={BUTTON_SECONDARY} disabled={isPending} onClick={() => create(true)}>
          Собрать вручную
        </button>
        <a
          className="text-sm font-semibold text-[var(--theme-text-muted)] underline-offset-4 hover:underline"
          href={`${prefix}/lessons/new?studentId=${studentId}`}
        >
          Больше настроек
        </a>
      </div>
    </div>
  );
}
