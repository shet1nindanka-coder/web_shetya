"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ShbzSelect } from "@/components/shbz-select";

type TeacherLessonCreateFormProps = {
  prefix: string;
  groupId: string;
  members: Array<{ id: string; name: string; speed: number | null }>;
  topics: Array<{ id: string; title: string }>;
};

const MAX_TEACHER_NOTE = 500;

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Авто" },
  ...Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} из 10` }))
];

const SPEED_OPTIONS = [
  { value: "", label: "Не указана" },
  ...Array.from({ length: 10 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))
];

export function TeacherLessonCreateForm({ prefix, groupId, members, topics }: TeacherLessonCreateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [targetDifficulty, setTargetDifficulty] = useState("");
  const [teacherNote, setTeacherNote] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(members.map((member) => member.id));
  const [speeds, setSpeeds] = useState<Record<string, string>>(
    Object.fromEntries(members.map((member) => [member.id, member.speed ? String(member.speed) : ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds((current) =>
      current.includes(topicId) ? current.filter((id) => id !== topicId) : [...current, topicId]
    );
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]
    );
  };

  const submit = () => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId,
            studentIds: selectedStudentIds,
            title: title.trim() || undefined,
            durationMinutes: Number(duration) || 60,
            topicIds: selectedTopicIds,
            targetDifficulty: targetDifficulty === "" ? null : Number(targetDifficulty),
            teacherNote: teacherNote.trim(),
            speeds: Object.fromEntries(
              selectedStudentIds.map((studentId) => [studentId, speeds[studentId] === "" ? null : Number(speeds[studentId])])
            )
          })
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; lessonId?: string; error?: string }
          | null;

        // 503 «ИИ недоступен» тоже возвращает lessonId — урок создан, собираем вручную.
        if (result?.lessonId) {
          router.push(`${prefix}/lessons/${result.lessonId}`);
          return;
        }

        setError(result?.error || "Не удалось создать урок. Попробуйте ещё раз.");
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
      className="space-y-7"
    >
      {error ? (
        <div className="shbz-notice-error px-5 py-4 text-sm font-medium" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Название урока
          </span>
          <input
            type="text"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Пусто — «Занятие от <дата>»"
            className="shbz-input"
          />
        </label>
        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Длительность, минут
          </span>
          <input
            type="number"
            value={duration}
            min={15}
            max={240}
            step={5}
            onChange={(event) => setDuration(event.target.value)}
            className="shbz-input"
          />
        </label>
        <div>
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Целевая сложность
          </span>
          <ShbzSelect
            ariaLabel="Целевая сложность"
            value={targetDifficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={setTargetDifficulty}
          />
        </div>
      </div>

      <div>
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Темы занятия
          <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
            ничего не отмечено — ИИ выберет сам
          </span>
        </span>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => {
            const active = selectedTopicIds.includes(topic.id);

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                className="rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition"
                style={
                  active
                    ? { background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }
                    : { background: "var(--shbz-tab-hover)", color: "var(--shbz-tab-text)" }
                }
              >
                {topic.title}
              </button>
            );
          })}
        </div>
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
          placeholder="Например: разобрать логарифмы, без стереометрии"
          className="shbz-input min-h-[84px] py-3"
          style={{ height: "auto" }}
        />
      </label>

      <div>
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Ученики и скорость (1–10)
        </span>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {members.map((member) => {
            const selected = selectedStudentIds.includes(member.id);

            return (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5"
                style={{ background: "var(--shbz-soft-bg)", opacity: selected ? 1 : 0.55 }}
              >
                <label className="flex min-w-0 items-center gap-2.5 text-sm font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleStudent(member.id)}
                    className="shbz-checkbox"
                  />
                  <span className="truncate">{member.name}</span>
                </label>
                <div style={{ width: 108 }}>
                  <ShbzSelect
                    size="xs"
                    ariaLabel={`Скорость: ${member.name}`}
                    value={speeds[member.id] ?? ""}
                    options={SPEED_OPTIONS}
                    onChange={(nextValue) => setSpeeds((current) => ({ ...current, [member.id]: nextValue }))}
                  />
                </div>
              </div>
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
          {isPending ? "Создаём урок…" : "Подобрать задания"}
        </span>
      </button>
    </form>
  );
}
