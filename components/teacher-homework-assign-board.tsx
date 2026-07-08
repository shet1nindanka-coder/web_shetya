"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { ShbzDateTimePicker } from "@/components/shbz-datetime-picker";
import { ShbzSelect } from "@/components/shbz-select";
import { cx } from "@/lib/utils";

type AssignBoardTopic = {
  id: string;
  title: string;
  totalNumbers: number;
  numbers: Array<{
    id: string;
    number: number;
    status: HomeworkNumberStatus | null;
    deadlineAt: string | null;
  }>;
};

type TeacherHomeworkAssignBoardProps = {
  studentId: string;
  topics: AssignBoardTopic[];
};

function inputToIso(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function TeacherHomeworkAssignBoard({ studentId, topics }: TeacherHomeworkAssignBoardProps) {
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState<string>(topics[0]?.id ?? "");
  const [selectedNumberIds, setSelectedNumberIds] = useState<ReadonlySet<string>>(new Set());
  const [title, setTitle] = useState("");
  const [deadlineValue, setDeadlineValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null,
    [selectedTopicId, topics]
  );

  const selectedCount = selectedNumberIds.size;

  const changeTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedNumberIds(new Set());
    setError(null);
    setSuccess(null);
  };

  const toggleNumber = (numberId: string) => {
    setSuccess(null);
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
    if (!selectedTopic) {
      return;
    }

    const deadlineAt = inputToIso(deadlineValue);

    if (!selectedCount || !deadlineAt) {
      setError("Выберите номера и укажите дедлайн.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/teacher/homeworks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          studentId,
          topicId: selectedTopic.id,
          homeworkNumberIds: Array.from(selectedNumberIds),
          deadlineAt,
          title: title.trim() || undefined
        })
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось выдать ДЗ.");
      }

      setSelectedNumberIds(new Set());
      setDeadlineValue("");
      setTitle("");
      setSuccess("ДЗ выдано. Посмотреть его можно во вкладке «Проверка ДЗ».");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось выдать ДЗ.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedTopic) {
    return null;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}
      {success ? (
        <div className="rounded-[8px] border border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] px-4 py-3 text-sm text-[var(--theme-success-text)]">
          {success}
        </div>
      ) : null}

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

      <div className="teacher-bulk-deadline-panel rounded-[14px] border px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-[12.5px] font-bold"
            style={{
              background: selectedCount > 0 ? "var(--theme-accent-soft)" : "var(--shbz-tab-hover)",
              color: selectedCount > 0 ? "var(--shbz-green-text)" : "var(--shbz-kicker)"
            }}
          >
            Выбрано: {selectedCount}
          </span>
          <div className="w-full min-w-[200px] sm:w-auto sm:max-w-[260px] sm:flex-1">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="Название (необязательно)"
              className="ui-input h-12 w-full rounded-[8px] px-3 text-sm"
            />
          </div>
          <div className="w-full min-w-[220px] sm:w-auto sm:max-w-[280px] sm:flex-1">
            <ShbzDateTimePicker
              value={deadlineValue}
              disabled={isSaving}
              onChange={setDeadlineValue}
              placeholder="Дедлайн"
            />
          </div>
          <button
            type="button"
            disabled={!selectedCount || !deadlineValue || isSaving}
            onClick={() => void submit()}
            className="ui-pressable ui-button-primary rounded-[12px] px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {isSaving ? "Выдаем..." : "Выдать ДЗ"}
          </button>
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
          1. Кликните по номерам ниже, чтобы выбрать их · 2. Задайте дедлайн · 3. Нажмите «Выдать ДЗ».
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
                "teacher-number-card ui-pressable rounded-[10px] border px-4 py-4 text-left transition",
                isSelected && "ring-2 ring-[var(--theme-accent-border)]"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cx(
                    "inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-bold",
                    isSelected
                      ? "border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]"
                      : "border-[var(--theme-border)] text-transparent"
                  )}
                  aria-hidden="true"
                >
                  ✓
                </span>
                <HomeworkStatusBadge status={number.status} />
              </div>
              <p className="teacher-number-title mt-3 text-lg font-semibold text-[var(--theme-text-strong)]">
                № {number.number}
              </p>
              {number.deadlineAt ? (
                <p className="ui-copy-muted mt-2 text-xs leading-5">Уже в ДЗ с дедлайном</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
