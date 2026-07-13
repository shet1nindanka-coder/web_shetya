"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { useCallback, useRef, useState } from "react";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { SectionCard } from "@/components/section-card";
import { TelegramSpoiler } from "@/components/telegram-spoiler";
import { markStudentTopicsNeedsRefresh } from "@/components/student-topics-refresh-bridge";
import { useStudentStreak } from "@/components/student-streak-provider";
import { cx, homeworkStatusMeta } from "@/lib/utils";

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
  const status = initialStatus;
  const [note, setNote] = useState(initialNote);
  const [savedNote, setSavedNote] = useState(initialNote);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const noteControllerRef = useRef<AbortController | null>(null);
  const noteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSaving = isSavingNote;
  const notePreview = note.trim().length > 120 ? `${note.trim().slice(0, 117)}...` : note.trim() || null;

  const saveNote = useCallback(async (value?: string) => {
    const draft = (value ?? note).trim();
    const saved = savedNote.trim();

    if (draft === saved) {
      setNote(savedNote);
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
      setNote(savedValue);
      setSavedNote(savedValue);
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
            {isSaving ? <span className="ui-copy-muted text-xs font-medium">Сохраняем...</span> : null}
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

        {(answerLatex || notesEnabled) ? (
          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-2">
            {answerLatex ? (
              <div className="min-w-0 rounded-[16px] border border-[var(--theme-border-soft)] p-2 sm:p-2.5">
                <p className="ui-kicker mb-1.5">Ответ</p>
                <TelegramSpoiler
                  className="rounded-[12px]"
                  ariaLabel={`Показать ответ к номеру ${number}`}
                >
                  <LatexAnswerPreview value={answerLatex} />
                </TelegramSpoiler>
              </div>
            ) : null}

            {notesEnabled ? (
              <div className="min-w-0 rounded-[16px] border border-[var(--theme-border-soft)] px-2.5 py-2 sm:px-3 sm:py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="ui-kicker">Заметка</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (isNoteOpen) {
                        flushNote();
                        setIsNoteOpen(false);
                      } else {
                        setIsNoteOpen(true);
                      }
                    }}
                    className="group inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--theme-border-soft)] bg-[var(--theme-surface-strong)] text-[var(--theme-text-muted)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent-border)] hover:border-[var(--theme-accent-border)] hover:text-[var(--theme-accent-text)]"
                    aria-expanded={isNoteOpen}
                    aria-label={isNoteOpen ? "Свернуть заметку" : "Редактировать заметку"}
                  >
                    {isNoteOpen ? (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487a2.25 2.25 0 113.182 3.182L8.25 19.463 3.75 20.25l.787-4.5L16.862 4.487z" />
                      </svg>
                    )}
                  </button>
                </div>

                {isNoteOpen ? (
                  <input
                    type="text"
                    maxLength={240}
                    value={note}
                    onChange={(event) => handleNoteChange(event.target.value)}
                    onBlur={() => {
                      flushNote();
                      setIsNoteOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.nativeEvent.isComposing || event.key !== "Enter") return;
                      event.preventDefault();
                      flushNote();
                      setIsNoteOpen(false);
                    }}
                    autoFocus
                    placeholder="Короткая заметка"
                    className="ui-input mt-1.5 w-full rounded-[12px] px-2.5 py-1.5 text-sm leading-5 sm:px-3 sm:py-2"
                  />
                ) : (
                  <p
                    role="button"
                    tabIndex={0}
                    onClick={() => setIsNoteOpen(true)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsNoteOpen(true); } }}
                    className={cx(
                      "mt-1.5 cursor-pointer truncate rounded-[12px] px-2.5 py-1.5 text-sm leading-5 transition hover:bg-[var(--theme-surface-soft)] sm:px-3 sm:py-2",
                      notePreview ? "text-[var(--theme-text-default)]" : "text-[var(--theme-text-muted)]"
                    )}
                  >
                    {notePreview ?? "Добавить заметку"}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
