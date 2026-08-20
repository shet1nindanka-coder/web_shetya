"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { ShbzDateTimePicker } from "@/components/shbz-datetime-picker";
import { ShbzSelect } from "@/components/shbz-select";
import { cx } from "@/lib/utils";

/*
 * Составление занятия вручную: та же сетка номеров, что и при выдаче ДЗ.
 * Отличия по сути две: вместо дедлайна — длительность занятия, и вместо
 * выдачи создаётся урок с выбранными номерами, который дальше ведётся на доске.
 */

type ComposeBoardTopic = {
  id: string;
  title: string;
  totalNumbers: number;
  numbers: Array<{
    id: string;
    number: string;
    status: HomeworkNumberStatus | null;
    inLesson: boolean;
    conditionLatex?: string | null;
  }>;
};

type TeacherLessonComposeBoardProps = {
  studentId: string;
  topics: ComposeBoardTopic[];
};

export function TeacherLessonComposeBoard({ studentId, topics }: TeacherLessonComposeBoardProps) {
  const pathname = usePathname();
  const routePrefix = pathname.startsWith("/developer") ? "/developer" : "/teacher";
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id ?? "");
  const [selectedNumberIds, setSelectedNumberIds] = useState<ReadonlySet<string>>(new Set());
  const [duration, setDuration] = useState("60");
  const [startsAt, setStartsAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null,
    [selectedTopicId, topics]
  );

  const selectedCount = selectedNumberIds.size;

  const changeTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedNumberIds(new Set());
    setError(null);
  };

  const toggleNumber = (numberId: string) => {
    setSelectedNumberIds((current) => {
      const next = new Set(current);

      if (next.has(numberId)) {
        next.delete(numberId);
      } else {
        next.add(numberId);
      }

      return next;
    });
  };

  const submit = async () => {
    if (!selectedCount) {
      setError("Выберите номера для занятия.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [studentId],
          durationMinutes: Number(duration) || 60,
          startsAt: startsAt || undefined,
          topicIds: [],
          targetDifficulty: null,
          teacherNote: "",
          skipPlan: true,
          numberIds: Array.from(selectedNumberIds)
        })
      });

      const result = (await response.json().catch(() => null)) as { lessonId?: string; error?: string } | null;

      if (!result?.lessonId) {
        throw new Error(result?.error || "Не удалось составить занятие.");
      }

      router.push(`${routePrefix}/lessons/${result.lessonId}?studentId=${studentId}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось составить занятие.");
      setIsSaving(false);
    }
  };

  if (!selectedTopic) {
    return null;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      <div className="space-y-2">
        <span className="ui-copy-muted block text-sm font-medium">Тема</span>
        <ShbzSelect
          value={selectedTopic.id}
          onChange={changeTopic}
          ariaLabel="Тема"
          options={topics.map((topic) => ({
            value: topic.id,
            label: `${topic.title} · ${topic.totalNumbers} номеров`
          }))}
        />
      </div>

      <div className="teacher-bulk-deadline-panel rounded-[16px] border px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-[8px] px-3 py-1 text-[12.5px] font-bold"
            style={{
              background: selectedCount > 0 ? "var(--shbz-green-soft)" : "var(--shbz-tab-hover)",
              color: selectedCount > 0 ? "var(--shbz-green-text)" : "var(--shbz-kicker)"
            }}
          >
            Выбрано: {selectedCount}
          </span>
          <div className="w-full min-w-[160px] sm:w-auto sm:max-w-[200px]">
            <input
              type="number"
              min={15}
              max={240}
              step={5}
              value={duration}
              disabled={isSaving}
              onChange={(event) => setDuration(event.target.value)}
              placeholder="Длительность, мин"
              aria-label="Длительность занятия в минутах"
              className="ui-input h-12 w-full rounded-[8px] px-3 text-sm"
            />
          </div>
          <div className="w-full min-w-[200px] sm:w-auto">
            <ShbzDateTimePicker
              value={startsAt}
              onChange={setStartsAt}
              disabled={isSaving}
              placeholder="Дата и время урока"
            />
          </div>
          <button
            type="button"
            disabled={!selectedCount || isSaving}
            onClick={() => void submit()}
            className="ui-pressable ui-button-primary rounded-[12px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {isSaving ? "Составляем..." : "Составить занятие"}
          </button>
          <a
            href={`${routePrefix}/lessons/new?studentId=${studentId}`}
            className="ui-pressable ui-button-secondary rounded-[12px] px-5 py-3 text-sm font-semibold no-underline transition"
          >
            Подобрать ИИ
          </a>
          {selectedCount > 0 ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => setSelectedNumberIds(new Set())}
              className="ui-pressable ui-button-secondary rounded-[12px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              Снять выбор
            </button>
          ) : null}
        </div>
        <p className="ui-hint mt-2.5 text-[13px] leading-5" style={{ color: "var(--shbz-text-muted)" }}>
          1. Кликните по номерам ниже · 2. Укажите длительность · 3. Нажмите «Составить занятие». Итоги по
          каждому номеру отметите на доске занятия.
        </p>
      </div>

      <div className="teacher-number-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {selectedTopic.numbers.map((number) => {
          const isSelected = selectedNumberIds.has(number.id);

          return (
            <button
              key={number.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleNumber(number.id)}
              className={cx(
                "teacher-number-card ui-pressable rounded-[16px] border px-4 py-4 text-left transition",
                isSelected && "ring-2 ring-[var(--shbz-accent-solid)]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cx(
                    "inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold",
                    isSelected
                      ? "border-[var(--shbz-accent-solid)] bg-[var(--shbz-green-soft)] text-[var(--shbz-green-text)]"
                      : "border-[var(--shbz-input-border)] text-transparent"
                  )}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <HomeworkStatusBadge status={number.status} />
              </div>
              <p className="teacher-number-title mt-3 text-lg font-semibold text-[var(--shbz-text-strong)]">
                № {number.number}
              </p>
              {number.conditionLatex ? (
                // Содержание задания, чтобы выбирать не вслепую; длинные условия обрезаются.
                <div className="mt-2 max-h-32 overflow-hidden text-left text-sm">
                  <LatexAnswerPreview value={number.conditionLatex} />
                </div>
              ) : null}
              {number.inLesson ? <p className="ui-copy-muted mt-2 text-xs leading-5">Уже был на занятии</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
