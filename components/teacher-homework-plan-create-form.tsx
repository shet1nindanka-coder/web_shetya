"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShbzDateTimePicker } from "@/components/shbz-datetime-picker";
import { ShbzSelect } from "@/components/shbz-select";

type TeacherHomeworkPlanCreateFormProps = {
  prefix: string;
  topics: Array<{ id: string; title: string }>;
  members: Array<{ id: string; name: string }>;
  defaultTopicId: string | null;
  defaultTitle: string;
  groupId: string | null;
  sourceLessonId: string | null;
};

const MAX_TEACHER_NOTE = 500;

export function TeacherHomeworkPlanCreateForm({
  prefix,
  topics,
  members,
  defaultTopicId,
  defaultTitle,
  groupId,
  sourceLessonId
}: TeacherHomeworkPlanCreateFormProps) {
  const router = useRouter();
  const [topicId, setTopicId] = useState(defaultTopicId ?? topics[0]?.id ?? "");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState("60");
  const [teacherNote, setTeacherNote] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(members.map((member) => member.id));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    );
  };

  const submit = () => {
    setError(null);

    if (!topicId) {
      setError("Выберите тему.");
      return;
    }

    if (!deadlineAt) {
      setError("Укажите дату следующего занятия — она станет дедлайном.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/homework-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId,
            deadlineAt: new Date(deadlineAt).toISOString(),
            // Поля названия в форме нет: для ДЗ по итогам занятия имя подставляет страница,
            // в остальных случаях его формирует сервер.
            title: defaultTitle.trim() || undefined,
            teacherNote: teacherNote.trim(),
            dailyMinutes: Number(dailyMinutes) || undefined,
            sourceLessonId: sourceLessonId ?? undefined,
            groupId: groupId ?? undefined,
            studentIds: selectedStudentIds
          })
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; planId?: string; error?: string }
          | null;

        // 503 «ИИ недоступен» тоже возвращает planId — черновик создан, собираем вручную.
        if (result?.planId) {
          // ДЗ одному ученику: остаёмся в контексте вкладки «ученики» (подсветка шапки).
          const context = selectedStudentIds.length === 1 ? `?studentId=${selectedStudentIds[0]}` : "";

          router.push(`${prefix}/homework-plans/${result.planId}${context}`);
          return;
        }

        setError(result?.error || "Не удалось создать черновик. Попробуйте ещё раз.");
      } catch {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      {error ? (
        <div className="shbz-notice-error px-5 py-4 text-sm font-medium" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div>
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Тема ДЗ
            <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
              всегда одна
            </span>
          </span>
          <ShbzSelect
            ariaLabel="Тема ДЗ"
            value={topicId}
            options={topics.map((topic) => ({ value: topic.id, label: topic.title }))}
            onChange={setTopicId}
          />
        </div>
        <div className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Дата следующего занятия
            <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
              станет дедлайном
            </span>
          </span>
          <ShbzDateTimePicker
            value={deadlineAt}
            onChange={setDeadlineAt}
            disabled={isPending}
            placeholder="Дата и время"
          />
        </div>
        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Минут в день
            <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
              бюджет = минуты × дни до дедлайна
            </span>
          </span>
          <input
            type="number"
            value={dailyMinutes}
            min={15}
            max={240}
            step={5}
            onChange={(event) => setDailyMinutes(event.target.value)}
            className="shbz-input"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Комментарий для ИИ
          <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
            {teacherNote.length} / {MAX_TEACHER_NOTE}
          </span>
        </span>
        <textarea
          value={teacherNote}
          maxLength={MAX_TEACHER_NOTE}
          rows={2}
          onChange={(event) => setTeacherNote(event.target.value)}
          placeholder="Например: закрепить дискриминант, без задач с параметром"
          className="shbz-input min-h-[84px] py-3"
          style={{ height: "auto" }}
        />
      </label>

      <div>
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Ученики
        </span>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {members.map((member) => {
            const selected = selectedStudentIds.includes(member.id);

            return (
              <label
                key={member.id}
                className="flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 text-sm font-semibold"
                style={{ background: "var(--shbz-soft-bg)", color: "var(--shbz-text-strong)", opacity: selected ? 1 : 0.55 }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleStudent(member.id)}
                  className="shbz-checkbox"
                />
                <span className="truncate">{member.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || selectedStudentIds.length === 0}
        className="shbz-btn-primary px-[26px] py-[13px] text-[15px]"
      >
        <span className="inline-flex items-center gap-2.5">
          {isPending ? <span className="shbz-spinner" aria-hidden /> : null}
          {isPending ? "Создаём черновик…" : "Подобрать ДЗ"}
        </span>
      </button>
    </form>
  );
}
