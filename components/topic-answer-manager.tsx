"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { cx } from "@/lib/utils";

const ANSWERS_PAGE_SIZE = 10;

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
  const [currentPage, setCurrentPage] = useState(1);

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

  const pageCount = Math.max(1, Math.ceil(items.length / ANSWERS_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((current) => Math.min(Math.max(1, current), pageCount));
  }, [pageCount]);

  const savedAnswersCount = useMemo(
    () => items.filter((item) => Boolean(item.savedAnswerLatex?.trim())).length,
    [items]
  );

  const currentPageItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ANSWERS_PAGE_SIZE;
    return items.slice(startIndex, startIndex + ANSWERS_PAGE_SIZE);
  }, [currentPage, items]);

  const visiblePageNumbers = useMemo(() => {
    if (pageCount <= 7) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    const pages = new Set<number>([1, pageCount]);

    for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
      if (page > 1 && page < pageCount) {
        pages.add(page);
      }
    }

    return Array.from(pages).sort((left, right) => left - right);
  }, [currentPage, pageCount]);

  const rangeStart = items.length ? (currentPage - 1) * ANSWERS_PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * ANSWERS_PAGE_SIZE, items.length);

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
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to save LaTeX answer for homework number.", { topicId, homeworkNumberId, error });
        }

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
    <div className="space-y-5">
      <div className="topic-answer-nav ui-surface ui-panel-soft rounded-[20px] p-4 sm:rounded-[22px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--theme-text-muted)]">Навигация по ответам</p>
            <p className="mt-2 text-base font-semibold text-[var(--theme-text-strong)]">
              Показаны номера {rangeStart}-{rangeEnd} из {items.length}
            </p>
            <p className="ui-hint mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
              Сохранено ответов: {savedAnswersCount} из {items.length}. Для больших тем ответы разбиты на страницы по{" "}
              {ANSWERS_PAGE_SIZE} номеров.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm text-[var(--theme-text-muted)]">
              <span>Страница</span>
              <select
                value={currentPage}
                onChange={(event) => setCurrentPage(Number(event.target.value))}
                className="ui-input rounded-[14px] px-4 py-2 text-sm font-medium"
              >
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="ui-pressable ui-button-secondary rounded-[14px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                disabled={currentPage === pageCount}
                className="ui-pressable ui-button-secondary rounded-[14px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {visiblePageNumbers.map((page, index) => {
            const previousPage = visiblePageNumbers[index - 1];
            const showGap = previousPage && page - previousPage > 1;

            return (
              <div key={page} className="flex items-center gap-2">
                {showGap ? <span className="px-1 text-sm text-[var(--theme-text-soft)]">...</span> : null}
                <button
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={cx(
                    "ui-pressable rounded-[14px] px-4 py-2 text-sm font-semibold transition",
                    page === currentPage ? "ui-button-tonal" : "ui-button-secondary"
                  )}
                >
                  {page}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {currentPageItems.map((item) => (
        <article
          key={item.id}
          className="topic-answer-card ui-fade-slide ui-surface ui-panel-soft rounded-[20px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-4.5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] text-[var(--theme-text-soft)]">Ответ к номеру</p>
              <h3 className="topic-answer-card-title font-display mt-1.5 text-[1.45rem] font-semibold text-[var(--theme-text-strong)]">№ {item.number}</h3>
            </div>
            <Badge
              className={
                item.savedAnswerLatex
                  ? "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]"
                  : "ui-badge-soft"
              }
            >
              {item.savedAnswerLatex ? "Сохранен" : "Пусто"}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--theme-text-default)]">LaTeX-ответ</span>
              <textarea
                rows={5}
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
                className="ui-input min-h-[138px] w-full rounded-[20px] px-4 py-3 text-sm outline-none transition focus:-translate-y-[1px]"
                disabled={item.isSaving || item.isDeleting}
              />
              <p className="ui-hint text-xs leading-5 text-[var(--theme-text-muted)]">
                Поддерживаются inline-формулы через <code>$...$</code> и отдельные блоки через <code>$$...$$</code>.
              </p>
            </label>

            {item.draftAnswerLatex.trim() ? (
              <div className="ui-panel-soft rounded-[20px] p-3">
                <p className="text-xs font-medium tracking-[0.18em] text-[var(--theme-text-soft)]">Предпросмотр</p>
                <div className="mt-2.5">
                  <LatexAnswerPreview value={item.draftAnswerLatex} />
                </div>
              </div>
            ) : (
              <div className="ui-hint ui-panel-soft rounded-[20px] border-dashed px-4 py-5 text-sm leading-6 text-[var(--theme-text-muted)]">
                Пока ответ к этому номеру не добавлен.
              </div>
            )}

            {item.error ? (
              <div className="ui-notice-error rounded-2xl px-4 py-4 text-sm font-medium">
                {item.error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void saveAnswer(item.id)}
                disabled={item.isSaving || item.isDeleting || !item.draftAnswerLatex.trim()}
                className="ui-pressable ui-button-primary rounded-[14px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
              >
                {item.isSaving ? "Сохраняем..." : "Сохранить ответ"}
              </button>

              {item.savedAnswerLatex ? (
                <button
                  type="button"
                  onClick={() => void removeAnswer(item.id)}
                  disabled={item.isDeleting || item.isSaving}
                  className="ui-pressable ui-button-danger rounded-[14px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.isDeleting ? "Удаляем..." : "Удалить ответ"}
                </button>
              ) : null}
            </div>
          </div>
        </article>
        ))}
      </div>

      {pageCount > 1 ? (
        <div className="ui-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[24px] px-4 py-4">
          <p className="text-sm text-[var(--theme-text-muted)]">
            Страница {currentPage} из {pageCount}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="ui-pressable ui-button-secondary rounded-[14px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Предыдущая страница
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              className="ui-pressable ui-button-secondary rounded-[14px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Следующая страница
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
