"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useCallback, useRef, useState } from "react";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { SectionCard } from "@/components/section-card";
import { TelegramSpoiler } from "@/components/telegram-spoiler";
import { markStudentTopicsNeedsRefresh } from "@/components/student-topics-refresh-bridge";
import { useStudentStreak } from "@/components/student-streak-provider";
import { homeworkStatusMeta } from "@/lib/utils";

type AnswerPart = { label: string; value: string };

// Разбивает многопунктовый ответ «А) $...$ Б) $...$» на пункты для сетки чипов.
// Возвращает null (и ответ рендерится как раньше), если формат не подошёл
// или разрез попал внутрь формулы.
function splitAnswerParts(latex: string): AnswerPart[] | null {
  const source = latex.trim();

  if (source.includes("$$") || source.includes("\\[") || /\n{2,}/.test(source)) {
    return null;
  }

  const matches = Array.from(source.matchAll(/(?:^|[\s.;,])([А-ЯЁ])\)\s*/g));

  if (matches.length < 3 || source.slice(0, matches[0].index ?? 0).trim() !== "") {
    return null;
  }

  const parts: AnswerPart[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? source.length) : source.length;
    const value = source.slice(start, end).trim().replace(/[;,]+$/, "").trim();

    if (!value || (value.split("$").length - 1) % 2 !== 0) {
      return null;
    }

    parts.push({ label: match[1], value });
  }

  return parts;
}

type StudentSingleNumberCardProps = {
  topicId: string;
  homeworkNumberId: string;
  number: number;
  conditionLatex: string | null;
  answerLatex: string | null;
  initialStatus: HomeworkNumberStatus | null;
  initialNote: string;
  deadlineAt: string | null;
  notesEnabled: boolean;
};

export function StudentSingleNumberCard({
  topicId,
  homeworkNumberId,
  number,
  conditionLatex,
  answerLatex,
  initialStatus,
  initialNote,
  deadlineAt: _deadlineAt,
  notesEnabled
}: StudentSingleNumberCardProps) {
  const streakContext = useStudentStreak();
  const answerParts = answerLatex ? splitAnswerParts(answerLatex) : null;
  const status = initialStatus;
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSavedFlash, setNoteSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const noteControllerRef = useRef<AbortController | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveNote = useCallback(async (value?: string) => {
    const draft = (value ?? note).trim();
    const saved = savedNote.trim();

    if (draft === saved) {
      return;
    }

    setSaveError(null);
    setIsSavingNote(true);

    noteControllerRef.current?.abort();
    const controller = new AbortController();
    noteControllerRef.current = controller;

    try {
      const response = await fetch("/api/student/topic-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, homeworkNumberId, note: value ?? note }),
        signal: controller.signal
      });

      const result = (await response.json().catch(() => null)) as { error?: string; note?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Заметка не сохранилась.");
      }

      const savedValue = typeof result?.note === "string" ? result.note : draft;
      setSavedNote(savedValue);
      setNoteSavedFlash(true);

      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = setTimeout(() => setNoteSavedFlash(false), 1600);
    } catch (error) {
      if (controller.signal.aborted) return;
      setSaveError(error instanceof Error ? error.message : "Заметка не сохранилась.");
    } finally {
      if (!controller.signal.aborted) {
        setIsSavingNote(false);
      }
    }
  }, [homeworkNumberId, note, savedNote, topicId]);

  const handleNoteChange = useCallback((value: string) => {
    setSaveError(null);
    setNoteSavedFlash(false);
    setNote(value);

    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
    }

    noteTimerRef.current = setTimeout(() => {
      void saveNote(value);
    }, 650);
  }, [saveNote]);

  const flushNote = useCallback(() => {
    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
      noteTimerRef.current = null;
    }

    void saveNote();
  }, [saveNote]);

  return (
    <SectionCard title={`Номер ${number}`}>
      {saveError ? (
        <div className="ui-notice-error mb-4 rounded-[12px] px-3.5 py-3 text-sm font-medium sm:mb-5 sm:px-4 sm:py-4">
          {saveError}
        </div>
      ) : null}

      <div className="space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-[1.55rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.9rem]">
              № {number}
            </h2>
            <HomeworkStatusBadge status={status} />
          </div>

          <p className="ui-hint ui-copy-muted text-xs leading-5 sm:max-w-[220px] sm:text-right">
            Статус выставляется автоматической проверкой решения или учителем.
          </p>
        </div>

        {conditionLatex ? (
          <div>
            <p className="ui-kicker mb-1.5">Условие</p>
            <div className="text-sm leading-relaxed text-[var(--theme-text-default)]">
              <LatexAnswerPreview value={conditionLatex} />
            </div>
          </div>
        ) : null}

        {answerLatex ? (
          <div className="shbz-panel-soft px-4 py-3.5">
            <p className="ui-kicker mb-2">Ответ</p>
            <TelegramSpoiler
              className="rounded-[12px]"
              ariaLabel={`Показать ответ к номеру ${number}`}
            >
              {answerParts ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1.5">
                  {answerParts.map((part, index) => (
                    <div
                      key={`${part.label}-${index}`}
                      className="flex min-w-0 items-baseline gap-2 rounded-[8px] border border-[var(--shbz-soft-border)] bg-[var(--shbz-card-bg)] px-2.5 py-1.5"
                    >
                      <span className="text-[11px] font-bold" style={{ color: "var(--shbz-kicker)" }}>
                        {part.label})
                      </span>
                      <span className="min-w-0">
                        <LatexAnswerPreview value={part.value} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <LatexAnswerPreview value={answerLatex} />
              )}
            </TelegramSpoiler>
          </div>
        ) : null}

        {notesEnabled ? (
          <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="ui-kicker">Заметка</p>
                  {isSavingNote ? (
                    <span className="ui-copy-muted text-xs font-medium">Сохраняем...</span>
                  ) : noteSavedFlash ? (
                    <span className="text-xs font-semibold" style={{ color: "var(--shbz-green-text)" }}>
                      Сохранено ✓
                    </span>
                  ) : null}
                </div>
                <textarea
                  maxLength={240}
                  rows={2}
                  value={note}
                  onChange={(event) => handleNoteChange(event.target.value)}
                  onBlur={() => flushNote()}
                  placeholder="Заметка для себя: что не понял, что спросить у учителя…"
                  className="shbz-note-field mt-1.5"
                  aria-label={`Заметка к номеру ${number}`}
                />
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
