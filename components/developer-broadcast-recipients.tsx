"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Student = {
  id: string;
  name: string;
};

type DeveloperBroadcastRecipientsProps = {
  students: Student[];
};

const MAX_SUGGESTIONS = 8;

export function DeveloperBroadcastRecipients({ students }: DeveloperBroadcastRecipientsProps) {
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [query, setQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const pickedSet = useMemo(() => new Set(pickedIds), [pickedIds]);
  const picked = useMemo(
    () => pickedIds.map((id) => students.find((student) => student.id === id)).filter(Boolean) as Student[],
    [pickedIds, students]
  );

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return [];
    }

    return students
      .filter((student) => !pickedSet.has(student.id) && student.name.toLowerCase().includes(normalized))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, students, pickedSet]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const pickStudent = (student: Student) => {
    setPickedIds((previous) => (previous.includes(student.id) ? previous : [...previous, student.id]));
    setQuery("");
    setIsDropdownOpen(false);
  };

  const removeStudent = (id: string) => {
    setPickedIds((previous) => previous.filter((pickedId) => pickedId !== id));
  };

  return (
    <div>
      <div className="shbz-seg mb-2.5" role="tablist" aria-label="Получатели">
        <button
          type="button"
          className="shbz-seg-btn"
          data-active={mode === "all" ? "true" : "false"}
          onClick={() => setMode("all")}
        >
          Всем ученикам
        </button>
        <button
          type="button"
          className="shbz-seg-btn"
          data-active={mode === "selected" ? "true" : "false"}
          onClick={() => setMode("selected")}
        >
          Выбранным
        </button>
      </div>

      {/* Данные для server action: режим и выбранные id */}
      {mode === "all" ? <input type="hidden" name="toAll" value="on" /> : null}
      {mode === "selected"
        ? pickedIds.map((id) => <input key={id} type="hidden" name="recipients" value={id} />)
        : null}

      {mode === "all" ? (
        <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Уведомление получат все ученики: {students.length}.
        </p>
      ) : (
        <div ref={boxRef} className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Начните вводить имя ученика…"
            className="shbz-input"
            aria-label="Поиск ученика"
          />

          {isDropdownOpen && query.trim() ? (
            <div
              className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 max-h-52 overflow-y-auto rounded-[12px] border border-[var(--shbz-card-border)] bg-[var(--shbz-card-bg)] py-1 shadow-lg"
            >
              {suggestions.length > 0 ? (
                suggestions.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => pickStudent(student)}
                    className="block w-full px-3.5 py-2 text-left text-sm text-[var(--theme-text-default)] transition hover:bg-[var(--shbz-tab-hover)]"
                  >
                    {student.name}
                  </button>
                ))
              ) : (
                <p className="px-3.5 py-2 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                  Никого не нашлось
                </p>
              )}
            </div>
          ) : null}

          {picked.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {picked.map((student) => (
                <span
                  key={student.id}
                  className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[13px] font-semibold"
                  style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
                >
                  {student.name}
                  <button
                    type="button"
                    onClick={() => removeStudent(student.id)}
                    aria-label={`Убрать ${student.name}`}
                    className="text-[15px] leading-none opacity-70 transition hover:opacity-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-2 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
            {picked.length > 0 ? `Выбрано: ${picked.length}` : "Пока никто не выбран — найдите ученика по имени."}
          </p>
        </div>
      )}
    </div>
  );
}
