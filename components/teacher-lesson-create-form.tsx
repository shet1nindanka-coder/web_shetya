"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ShbzSelect } from "@/components/shbz-select";

type TeacherLessonCreateFormProps = {
  prefix: string;
  /** Не задан — индивидуальный урок без группы. */
  groupId?: string;
  members: Array<{ id: string; name: string; speed: number | null }>;
  topics: Array<{ id: string; title: string }>;
};

const MAX_TEACHER_NOTE = 500;
const MAX_TOPIC_SUGGESTIONS = 8;

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
  const [topicQuery, setTopicQuery] = useState("");
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const topicBoxRef = useRef<HTMLDivElement | null>(null);
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

  const selectedTopics = useMemo(
    () => topics.filter((topic) => selectedTopicIds.includes(topic.id)),
    [topics, selectedTopicIds]
  );

  // Тем бывает несколько десятков, поэтому список не показываем вовсе: подсказки
  // всплывают под полем по мере ввода, выбранные копятся строкой ниже.
  const topicSuggestions = useMemo(() => {
    const query = topicQuery.trim().toLocaleLowerCase("ru-RU");

    if (!query) {
      return [];
    }

    return topics
      .filter(
        (topic) =>
          !selectedTopicIds.includes(topic.id) && topic.title.toLocaleLowerCase("ru-RU").includes(query)
      )
      .slice(0, MAX_TOPIC_SUGGESTIONS);
  }, [topics, selectedTopicIds, topicQuery]);

  const pickTopic = (topicId: string) => {
    setSelectedTopicIds((current) => (current.includes(topicId) ? current : [...current, topicId]));
    setTopicQuery("");
    setIsTopicDropdownOpen(false);
  };

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (topicBoxRef.current && !topicBoxRef.current.contains(event.target as Node)) {
        setIsTopicDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  // Бейдж на свёрнутом блоке: сколько параметров отличается от дефолтов.
  const changedParamsCount = [
    title.trim() !== "",
    duration !== "60",
    targetDifficulty !== "",
    selectedTopicIds.length > 0,
    teacherNote.trim() !== "",
    selectedStudentIds.length !== members.length,
    members.some((member) => (speeds[member.id] ?? "") !== (member.speed ? String(member.speed) : ""))
  ].filter(Boolean).length;

  const submit = () => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: groupId || undefined,
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
          // Индивидуальный урок: остаёмся в контексте вкладки «ученики» (подсветка шапки).
          const context = !groupId && selectedStudentIds.length === 1 ? `?studentId=${selectedStudentIds[0]}` : "";

          router.push(`${prefix}/lessons/${result.lessonId}${context}`);
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

      {/* Одно видимое решение — «Подобрать задания»; всё остальное — параметры
          подбора со здравыми дефолтами, свёрнутые в блок с бейджем изменений. */}
      <details className="rounded-[16px] border" style={{ borderColor: "var(--shbz-soft-border)" }}>
        <summary
          className="flex cursor-pointer list-none flex-wrap items-center gap-2.5 px-5 py-4 text-sm font-bold [&::-webkit-details-marker]:hidden"
          style={{ color: "var(--shbz-text-strong)" }}
        >
          Параметры подбора
          {changedParamsCount > 0 ? (
            <span className="shbz-chip" style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)", padding: "3px 9px" }}>
              изменено: {changedParamsCount}
            </span>
          ) : (
            <span className="ui-hint text-xs font-normal" style={{ color: "var(--shbz-text-muted)" }}>
              по умолчанию: 60 минут, все ученики, темы и сложность выберет ИИ
            </span>
          )}
          <svg
            className="ml-auto h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--shbz-kicker)" }}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>

        <div className="space-y-7 px-5 pb-5">
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

      <div ref={topicBoxRef} className="relative">
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Темы занятия
        </span>

        <input
          type="text"
          value={topicQuery}
          onChange={(event) => {
            setTopicQuery(event.target.value);
            setIsTopicDropdownOpen(true);
          }}
          onFocus={() => setIsTopicDropdownOpen(true)}
          placeholder="Начните вводить название темы…"
          aria-label="Поиск темы"
          className="shbz-input"
        />

        {isTopicDropdownOpen && topicQuery.trim() ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-52 overflow-y-auto rounded-[12px] border border-[var(--shbz-card-border)] bg-[var(--shbz-card-bg)] py-1 shadow-lg">
            {topicSuggestions.length > 0 ? (
              topicSuggestions.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => pickTopic(topic.id)}
                  className="block w-full px-3.5 py-2 text-left text-sm text-[var(--theme-text-default)] transition hover:bg-[var(--shbz-tab-hover)]"
                >
                  {topic.title}
                </button>
              ))
            ) : (
              <p className="px-3.5 py-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                Ничего не нашлось
              </p>
            )}
          </div>
        ) : null}

        {selectedTopics.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {selectedTopics.map((topic) => (
              <span
                key={topic.id}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[13px] font-semibold"
                style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
              >
                {topic.title}
                <button
                  type="button"
                  onClick={() => toggleTopic(topic.id)}
                  aria-label={`Убрать тему «${topic.title}»`}
                  className="text-[15px] leading-none opacity-70 transition hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <p className="mt-2 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
          {selectedTopics.length > 0
            ? `Выбрано тем: ${selectedTopics.length}`
            : "Можно не выбирать ничего — тогда ИИ сам определит, где ученик остановился."}
        </p>
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
        </div>
      </details>

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
