"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";

type NumberAnswerCard = {
  id: string;
  number: number;
  savedAnswerLatex: string | null;
  draftAnswerLatex: string;
  isSaving: boolean;
  error: string | null;
  isDeleting: boolean;
};

type TopicAnswerManagerProps = {
  topicId: string;
  numbers: Array<{
    id: string;
    number: number;
    answerLatex: string | null;
  }>;
};

function getAttachErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  if (status === 400) {
    return "Не удалось привязать ответ к номеру.";
  }

  return "Сохранение ответа не удалось.";
}

function getDeleteErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  return "Не удалось удалить ответ.";
}

export function TopicAnswerManager({ topicId, numbers }: TopicAnswerManagerProps) {
  const initialState = useMemo<NumberAnswerCard[]>(
    () =>
      numbers.map((number) => ({
        id: number.id,
        number: number.number,
        savedAnswerLatex: number.answerLatex,
        draftAnswerLatex: number.answerLatex ?? "",
        isSaving: false,
        error: null,
        isDeleting: false
      })),
    [numbers]
  );
  const numbersRef = useRef<NumberAnswerCard[]>(initialState);
  const [items, setItems] = useState(initialState);

  const updateItems = useCallback((updater: (current: NumberAnswerCard[]) => NumberAnswerCard[]) => {
    setItems((current) => {
      const next = updater(current);
      numbersRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    numbersRef.current = initialState;
    setItems(initialState);
  }, [initialState]);

  const attachUploadedAnswer = useCallback(
    async (homeworkNumberId: string, answerLatex: string) => {
      const response = await fetch("/api/teacher/number-answers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          homeworkNumberId,
          answerLatex
        })
      });

      const result = (await response.json().catch(() => null)) as { answerLatex?: string; error?: string } | null;

      if (!response.ok || !result?.answerLatex) {
        throw new Error(result?.error || getAttachErrorMessage(response.status));
      }

      return result.answerLatex;
    },
    []
  );

  const saveAnswer = useCallback(
    async (homeworkNumberId: string) => {
      const currentItem = numbersRef.current.find((item) => item.id === homeworkNumberId);
      const nextAnswerLatex = currentItem?.draftAnswerLatex.trim() ?? "";

      if (!currentItem || !nextAnswerLatex) {
        return;
      }

      if (currentItem.savedAnswerLatex?.trim() === nextAnswerLatex) {
        return;
      }

      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isSaving: true,
                error: null
              }
            : item
        )
      );

      try {
        const answerLatex = await attachUploadedAnswer(homeworkNumberId, nextAnswerLatex);

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                ...item,
                savedAnswerLatex: answerLatex,
                draftAnswerLatex: answerLatex,
                isSaving: false,
                error: null
              }
            : item
          )
        );
      } catch (error) {
        console.error("Failed to save LaTeX answer for homework number.", { topicId, homeworkNumberId, error });

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                ...item,
                isSaving: false,
                error: error instanceof Error ? error.message : "Не удалось сохранить ответ."
              }
            : item
          )
        );
      }
    },
    [attachUploadedAnswer, topicId, updateItems]
  );

  const removeAnswer = useCallback(
    async (homeworkNumberId: string) => {
      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isDeleting: true,
                error: null
              }
            : item
        )
      );

      try {
        const response = await fetch("/api/teacher/number-answers", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            homeworkNumberId
          })
        });

        const result = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error || getDeleteErrorMessage(response.status));
        }

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                ...item,
                savedAnswerLatex: null,
                draftAnswerLatex: "",
                isDeleting: false,
                error: null
              }
              : item
          )
        );
      } catch (error) {
        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  isDeleting: false,
                  error: error instanceof Error ? error.message : "Не удалось удалить ответ."
                }
              : item
          )
        );
      }
    },
    [updateItems]
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="ui-fade-slide ui-surface rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.06)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">LaTeX-ответ к заданию</p>
              <h3 className="font-display mt-2 text-2xl font-semibold text-slate-950">№ {item.number}</h3>
            </div>
            <Badge
              className={
                item.savedAnswerLatex
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
              }
            >
              {item.savedAnswerLatex ? "Ответ сохранен" : "Ответа пока нет"}
            </Badge>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Введите ответ в формате LaTeX</span>
              <textarea
                rows={7}
                value={item.draftAnswerLatex}
                onChange={(event) =>
                  updateItems((current) =>
                    current.map((currentItem) =>
                      currentItem.id === item.id
                        ? {
                            ...currentItem,
                            draftAnswerLatex: event.target.value,
                            error: null
                          }
                        : currentItem
                    )
                  )
                }
                placeholder={"Например:\n$$x = \\frac{-b \\pm \\sqrt{D}}{2a}$$\n\nИли с текстом:\nПодставим в формулу: $D=b^2-4ac$"}
                className="min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white"
                disabled={item.isSaving || item.isDeleting}
              />
              <p className="text-sm leading-6 text-slate-500">
                Поддерживаются inline-формулы через <code>$...$</code> и отдельные блоки через <code>$$...$$</code>.
              </p>
            </label>

            {item.draftAnswerLatex.trim() ? (
              <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Предпросмотр</p>
                <div className="mt-3">
                  <LatexAnswerPreview value={item.draftAnswerLatex} />
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-6 text-slate-500">
                Пока ответ к этому номеру не добавлен.
              </div>
            )}

            {item.error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-900">
                {item.error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveAnswer(item.id)}
                disabled={item.isSaving || item.isDeleting || !item.draftAnswerLatex.trim()}
                className="ui-pressable rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {item.isSaving ? "Сохраняем..." : "Сохранить ответ"}
              </button>

              {item.savedAnswerLatex ? (
                <button
                  type="button"
                  onClick={() => void removeAnswer(item.id)}
                  disabled={item.isDeleting || item.isSaving}
                  className="ui-pressable rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.isDeleting ? "Удаляем..." : "Удалить ответ"}
                </button>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
