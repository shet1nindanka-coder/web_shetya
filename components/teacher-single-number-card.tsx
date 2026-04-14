"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { cx } from "@/lib/utils";

type TeacherSingleNumberCardProps = {
  topicId: string;
  homeworkNumberId: string;
  number: number;
  initialConditionLatex: string | null;
  initialAnswerLatex: string | null;
};

function getCardStatus(conditionLatex: string | null, answerLatex: string | null) {
  const hasCondition = Boolean(conditionLatex?.trim());
  const hasAnswer = Boolean(answerLatex?.trim());

  if (hasCondition && hasAnswer) {
    return {
      className: "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]",
      label: "Условие и ответ"
    };
  }

  if (hasCondition || hasAnswer) {
    return {
      className: "border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]",
      label: "Частично заполнено"
    };
  }

  return { className: "ui-badge-soft", label: "Пусто" };
}

export function TeacherSingleNumberCard({
  topicId: _topicId,
  homeworkNumberId,
  number,
  initialConditionLatex,
  initialAnswerLatex
}: TeacherSingleNumberCardProps) {
  const [savedCondition, setSavedCondition] = useState(initialConditionLatex);
  const [draftCondition, setDraftCondition] = useState(initialConditionLatex ?? "");
  const [isSavingCondition, setIsSavingCondition] = useState(false);
  const [conditionError, setConditionError] = useState<string | null>(null);

  const [savedAnswer, setSavedAnswer] = useState(initialAnswerLatex);
  const [draftAnswer, setDraftAnswer] = useState(initialAnswerLatex ?? "");
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const status = getCardStatus(savedCondition, savedAnswer);

  const saveCondition = useCallback(async () => {
    const trimmed = draftCondition.trim();

    if (!trimmed || savedCondition?.trim() === trimmed) return;

    setIsSavingCondition(true);
    setConditionError(null);

    try {
      const response = await fetch("/api/teacher/number-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkNumberId, conditionLatex: trimmed })
      });

      const result = (await response.json().catch(() => null)) as { conditionLatex?: string; error?: string } | null;

      if (!response.ok || !result?.conditionLatex) {
        throw new Error(result?.error || "Сохранение условия не удалось.");
      }

      setSavedCondition(result.conditionLatex);
      setDraftCondition(result.conditionLatex);
    } catch (error) {
      setConditionError(error instanceof Error ? error.message : "Сохранение условия не удалось.");
    } finally {
      setIsSavingCondition(false);
    }
  }, [draftCondition, homeworkNumberId, savedCondition]);

  const deleteCondition = useCallback(async () => {
    if (!savedCondition) return;

    setIsSavingCondition(true);
    setConditionError(null);

    try {
      const response = await fetch("/api/teacher/number-conditions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkNumberId })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Не удалось удалить условие.");
      }

      setSavedCondition(null);
      setDraftCondition("");
    } catch (error) {
      setConditionError(error instanceof Error ? error.message : "Не удалось удалить условие.");
    } finally {
      setIsSavingCondition(false);
    }
  }, [homeworkNumberId, savedCondition]);

  const saveAnswer = useCallback(async () => {
    const trimmed = draftAnswer.trim();

    if (!trimmed || savedAnswer?.trim() === trimmed) return;

    setIsSavingAnswer(true);
    setAnswerError(null);

    try {
      const response = await fetch("/api/teacher/number-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkNumberId, answerLatex: trimmed })
      });

      const result = (await response.json().catch(() => null)) as { answerLatex?: string; error?: string } | null;

      if (!response.ok || !result?.answerLatex) {
        throw new Error(result?.error || "Сохранение ответа не удалось.");
      }

      setSavedAnswer(result.answerLatex);
      setDraftAnswer(result.answerLatex);
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : "Сохранение ответа не удалось.");
    } finally {
      setIsSavingAnswer(false);
    }
  }, [draftAnswer, homeworkNumberId, savedAnswer]);

  const deleteAnswer = useCallback(async () => {
    if (!savedAnswer) return;

    setIsSavingAnswer(true);
    setAnswerError(null);

    try {
      const response = await fetch("/api/teacher/number-answers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeworkNumberId })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Не удалось удалить ответ.");
      }

      setSavedAnswer(null);
      setDraftAnswer("");
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : "Не удалось удалить ответ.");
    } finally {
      setIsSavingAnswer(false);
    }
  }, [homeworkNumberId, savedAnswer]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h3 className="font-display text-xl font-semibold text-[var(--theme-text-strong)] sm:text-2xl">
          № {number}
        </h3>
        <Badge className={status.className}>{status.label}</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Условие */}
        <div className="space-y-2.5 rounded-[8px] border border-[var(--theme-border-soft)] p-3 sm:rounded-[10px] sm:p-4">
          <p className="ui-kicker">Условие (LaTeX)</p>

          <textarea
            value={draftCondition}
            onChange={(event) => setDraftCondition(event.target.value)}
            placeholder="Введите условие в формате LaTeX"
            rows={4}
            className="ui-input w-full rounded-[10px] px-3 py-2 font-mono text-sm sm:rounded-[12px]"
          />

          {savedCondition ? (
            <div className="rounded-[10px] border border-[var(--theme-border-soft)] p-2 sm:rounded-[12px] sm:p-2.5">
              <p className="mb-1 text-xs font-medium text-[var(--theme-text-muted)]">Предпросмотр</p>
              <LatexAnswerPreview value={savedCondition} />
            </div>
          ) : null}

          {conditionError ? (
            <p className="text-xs font-medium text-[var(--theme-danger-text)]">{conditionError}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveCondition}
              disabled={isSavingCondition || !draftCondition.trim() || draftCondition.trim() === savedCondition?.trim()}
              className={cx(
                "ui-pressable rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]",
                "bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-strong)] disabled:opacity-50"
              )}
            >
              {isSavingCondition ? "Сохраняем..." : "Сохранить условие"}
            </button>

            {savedCondition ? (
              <button
                type="button"
                onClick={deleteCondition}
                disabled={isSavingCondition}
                className="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]"
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>

        {/* Ответ */}
        <div className="space-y-2.5 rounded-[8px] border border-[var(--theme-border-soft)] p-3 sm:rounded-[10px] sm:p-4">
          <p className="ui-kicker">Ответ (LaTeX)</p>

          <textarea
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            placeholder="Введите ответ в формате LaTeX"
            rows={4}
            className="ui-input w-full rounded-[10px] px-3 py-2 font-mono text-sm sm:rounded-[12px]"
          />

          {savedAnswer ? (
            <div className="rounded-[10px] border border-[var(--theme-border-soft)] p-2 sm:rounded-[12px] sm:p-2.5">
              <p className="mb-1 text-xs font-medium text-[var(--theme-text-muted)]">Предпросмотр</p>
              <LatexAnswerPreview value={savedAnswer} />
            </div>
          ) : null}

          {answerError ? (
            <p className="text-xs font-medium text-[var(--theme-danger-text)]">{answerError}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveAnswer}
              disabled={isSavingAnswer || !draftAnswer.trim() || draftAnswer.trim() === savedAnswer?.trim()}
              className={cx(
                "ui-pressable rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]",
                "bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent-strong)] disabled:opacity-50"
              )}
            >
              {isSavingAnswer ? "Сохраняем..." : "Сохранить ответ"}
            </button>

            {savedAnswer ? (
              <button
                type="button"
                onClick={deleteAnswer}
                disabled={isSavingAnswer}
                className="ui-pressable ui-button-danger rounded-[10px] px-3.5 py-2 text-sm font-semibold transition sm:rounded-[12px]"
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
