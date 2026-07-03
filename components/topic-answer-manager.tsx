"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/badge";
import { ShbzSelect } from "@/components/shbz-select";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { cx } from "@/lib/utils";

const ANSWERS_PAGE_SIZE = 10;

type NumberAnswerCard = {
  id: string;
  number: number;
  savedConditionLatex: string | null;
  draftConditionLatex: string;
  isSavingCondition: boolean;
  conditionError: string | null;
  isDeletingCondition: boolean;
  savedAnswerLatex: string | null;
  draftAnswerLatex: string;
  isSavingAnswer: boolean;
  answerError: string | null;
  isDeletingAnswer: boolean;
};

type TopicAnswerManagerProps = {
  topicId: string;
  initialNumber?: number | null;
  numbers: Array<{
    id: string;
    number: number;
    conditionLatex: string | null;
    answerLatex: string | null;
  }>;
};

function getAnswerSaveErrorMessage(status: number) {
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

function getAnswerDeleteErrorMessage(status: number) {
  if (status === 401) {
    return "Сессия истекла. Обновите страницу и войдите заново.";
  }

  if (status === 404) {
    return "Номер больше не найден. Обновите страницу.";
  }

  return "Не удалось удалить ответ.";
}

function getCardStatus(item: NumberAnswerCard) {
  const hasCondition = Boolean(item.savedConditionLatex?.trim());
  const hasAnswer = Boolean(item.savedAnswerLatex?.trim());

  if (hasCondition && hasAnswer) {
    return {
      className:
        "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]",
      label: "Условие и ответ"
    };
  }

  if (hasCondition || hasAnswer) {
    return {
      className:
        "border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]",
      label: "Частично заполнено"
    };
  }

  return {
    className: "ui-badge-soft",
    label: "Пусто"
  };
}

export function TopicAnswerManager({ topicId, initialNumber = null, numbers }: TopicAnswerManagerProps) {
  const initialState = useMemo<NumberAnswerCard[]>(
    () =>
      numbers.map((number) => ({
        id: number.id,
        number: number.number,
        savedConditionLatex: number.conditionLatex,
        draftConditionLatex: number.conditionLatex ?? "",
        isSavingCondition: false,
        conditionError: null,
        isDeletingCondition: false,
        savedAnswerLatex: number.answerLatex,
        draftAnswerLatex: number.answerLatex ?? "",
        isSavingAnswer: false,
        answerError: null,
        isDeletingAnswer: false
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

  useEffect(() => {
    if (!initialNumber) {
      return;
    }

    const matchingIndex = initialState.findIndex((item) => item.number === initialNumber);

    if (matchingIndex === -1) {
      return;
    }

    setCurrentPage(Math.floor(matchingIndex / ANSWERS_PAGE_SIZE) + 1);
  }, [initialNumber, initialState]);

  const pageCount = Math.max(1, Math.ceil(items.length / ANSWERS_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((current) => Math.min(Math.max(1, current), pageCount));
  }, [pageCount]);

  const savedConditionsCount = useMemo(
    () => items.filter((item) => Boolean(item.savedConditionLatex?.trim())).length,
    [items]
  );

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

  const saveConditionLatexRequest = useCallback(
    async (homeworkNumberId: string, conditionLatex: string) => {
      const response = await fetch("/api/teacher/number-conditions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          homeworkNumberId,
          conditionLatex
        })
      });

      const result = (await response.json().catch(() => null)) as { conditionLatex?: string; error?: string } | null;

      if (!response.ok || !result?.conditionLatex) {
        throw new Error(result?.error || "Сохранение условия не удалось.");
      }

      return result.conditionLatex;
    },
    []
  );

  const saveAnswerLatexRequest = useCallback(
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
        throw new Error(result?.error || getAnswerSaveErrorMessage(response.status));
      }

      return result.answerLatex;
    },
    []
  );

  const saveCondition = useCallback(
    async (homeworkNumberId: string) => {
      const currentItem = numbersRef.current.find((item) => item.id === homeworkNumberId);
      const nextConditionLatex = currentItem?.draftConditionLatex.trim() ?? "";

      if (!currentItem || !nextConditionLatex) {
        return;
      }

      if (currentItem.savedConditionLatex?.trim() === nextConditionLatex) {
        return;
      }

      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isSavingCondition: true,
                conditionError: null
              }
            : item
        )
      );

      try {
        const conditionLatex = await saveConditionLatexRequest(homeworkNumberId, nextConditionLatex);

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  savedConditionLatex: conditionLatex,
                  draftConditionLatex: conditionLatex,
                  isSavingCondition: false,
                  conditionError: null
                }
              : item
          )
        );
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to save LaTeX condition for homework number.", { topicId, homeworkNumberId, error });
        }

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  isSavingCondition: false,
                  conditionError: error instanceof Error ? error.message : "Не удалось сохранить условие."
                }
              : item
          )
        );
      }
    },
    [saveConditionLatexRequest, topicId, updateItems]
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
                isSavingAnswer: true,
                answerError: null
              }
            : item
        )
      );

      try {
        const answerLatex = await saveAnswerLatexRequest(homeworkNumberId, nextAnswerLatex);

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  savedAnswerLatex: answerLatex,
                  draftAnswerLatex: answerLatex,
                  isSavingAnswer: false,
                  answerError: null
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
                  isSavingAnswer: false,
                  answerError: error instanceof Error ? error.message : "Не удалось сохранить ответ."
              }
            : item
          )
        );
      }
    },
    [saveAnswerLatexRequest, topicId, updateItems]
  );

  const removeCondition = useCallback(
    async (homeworkNumberId: string) => {
      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isDeletingCondition: true,
                conditionError: null
              }
            : item
        )
      );

      try {
        const response = await fetch("/api/teacher/number-conditions", {
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
          throw new Error(result?.error || "Не удалось удалить условие.");
        }

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  savedConditionLatex: null,
                  draftConditionLatex: "",
                  isDeletingCondition: false,
                  conditionError: null
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
                  isDeletingCondition: false,
                  conditionError: error instanceof Error ? error.message : "Не удалось удалить условие."
                }
              : item
          )
        );
      }
    },
    [updateItems]
  );

  const removeAnswer = useCallback(
    async (homeworkNumberId: string) => {
      updateItems((current) =>
        current.map((item) =>
          item.id === homeworkNumberId
            ? {
                ...item,
                isDeletingAnswer: true,
                answerError: null
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
          throw new Error(result?.error || getAnswerDeleteErrorMessage(response.status));
        }

        updateItems((current) =>
          current.map((item) =>
            item.id === homeworkNumberId
              ? {
                  ...item,
                  savedAnswerLatex: null,
                  draftAnswerLatex: "",
                  isDeletingAnswer: false,
                  answerError: null
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
                  isDeletingAnswer: false,
                  answerError: error instanceof Error ? error.message : "Не удалось удалить ответ."
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
      <div className="topic-answer-nav ui-toolbar-shell rounded-[10px] p-4 sm:rounded-[10px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--theme-text-muted)]">Навигация по условиям и ответам</p>
            <p className="mt-2 text-base font-semibold text-[var(--theme-text-strong)]">
              Показаны номера {rangeStart}-{rangeEnd} из {items.length}
            </p>
            <p className="ui-hint mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
              Сохранено условий: {savedConditionsCount} из {items.length}. Сохранено ответов: {savedAnswersCount} из{" "}
              {items.length}. Для больших тем блок разбит на страницы по {ANSWERS_PAGE_SIZE} номеров.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 text-sm text-[var(--theme-text-muted)]">
              <span>Страница</span>
              <div style={{ width: 96 }}>
                <ShbzSelect
                  size="xs"
                  ariaLabel="Страница"
                  value={String(currentPage)}
                  onChange={(nextValue) => setCurrentPage(Number(nextValue))}
                  options={Array.from({ length: pageCount }, (_, index) => ({
                    value: String(index + 1),
                    label: String(index + 1)
                  }))}
                />
              </div>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                disabled={currentPage === pageCount}
                className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
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
                    "ui-pressable rounded-[12px] px-4 py-2 text-sm font-semibold transition",
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
        {currentPageItems.map((item) => {
          const cardStatus = getCardStatus(item);

          return (
            <article
              key={item.id}
              className={cx(
                "topic-answer-card ui-fade-slide ui-panel-soft rounded-[10px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-4.5",
                item.number === initialNumber
                  ? "ring-2 ring-[var(--theme-accent-border)] ring-offset-2 ring-offset-transparent"
                  : ""
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.18em] text-[var(--theme-text-soft)]">
                    Материалы к номеру
                  </p>
                  <h3 className="topic-answer-card-title font-display mt-1.5 text-[1.45rem] font-semibold text-[var(--theme-text-strong)]">
                    № {item.number}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      item.savedConditionLatex
                        ? "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]"
                        : "ui-badge-soft"
                    }
                  >
                    {item.savedConditionLatex ? "Условие есть" : "Без условия"}
                  </Badge>
                  <Badge
                    className={
                      item.savedAnswerLatex
                        ? "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]"
                        : "ui-badge-soft"
                    }
                  >
                    {item.savedAnswerLatex ? "Ответ есть" : "Без ответа"}
                  </Badge>
                  <Badge className={cardStatus.className}>{cardStatus.label}</Badge>
                </div>
              </div>

              <div className="mt-4 space-y-5">
                <section className="space-y-3">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--theme-text-default)]">LaTeX-условие</span>
                    <textarea
                      rows={4}
                      value={item.draftConditionLatex}
                      onChange={(event) =>
                        updateItems((current) =>
                          current.map((currentItem) =>
                            currentItem.id === item.id
                              ? {
                                  ...currentItem,
                                  draftConditionLatex: event.target.value,
                                  conditionError: null
                                }
                              : currentItem
                          )
                        )
                      }
                      placeholder={
                        "Например:\nРешите уравнение $$2x^2-3x-5=0$$\n\nМожно добавлять текст и формулы в одном поле."
                      }
                      className="ui-input min-h-[124px] w-full rounded-[8px] px-4 py-3 text-sm outline-none transition focus:-translate-y-[1px]"
                      disabled={item.isSavingCondition || item.isDeletingCondition}
                    />
                    <p className="ui-hint text-xs leading-5 text-[var(--theme-text-muted)]">
                      Поддерживаются inline-формулы через <code>$...$</code> и отдельные блоки через <code>$$...$$</code>.
                    </p>
                  </label>

                  {item.draftConditionLatex.trim() ? (
                    <div className="ui-panel-soft rounded-[8px] p-3">
                      <p className="text-xs font-medium tracking-[0.18em] text-[var(--theme-text-soft)]">Предпросмотр условия</p>
                      <div className="mt-2.5">
                        <LatexAnswerPreview value={item.draftConditionLatex} />
                      </div>
                    </div>
                  ) : (
                    <div className="ui-hint ui-panel-soft rounded-[8px] border-dashed px-4 py-5 text-sm leading-6 text-[var(--theme-text-muted)]">
                      Пока условие к этому номеру не добавлено.
                    </div>
                  )}

                  {item.conditionError ? (
                    <div className="ui-notice-error rounded-[8px] px-4 py-4 text-sm font-medium">{item.conditionError}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveCondition(item.id)}
                      disabled={
                        item.isSavingCondition || item.isDeletingCondition || !item.draftConditionLatex.trim()
                      }
                      className="ui-pressable ui-button-primary rounded-[12px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                    >
                      {item.isSavingCondition ? "Сохраняем..." : "Сохранить условие"}
                    </button>

                    {item.savedConditionLatex ? (
                      <button
                        type="button"
                        onClick={() => void removeCondition(item.id)}
                        disabled={item.isDeletingCondition || item.isSavingCondition}
                        className="ui-pressable ui-button-danger rounded-[12px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {item.isDeletingCondition ? "Удаляем..." : "Удалить условие"}
                      </button>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-3 border-t border-[var(--theme-border-soft)] pt-4">
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
                                  answerError: null
                                }
                              : currentItem
                          )
                        )
                      }
                      placeholder={
                        "Например:\n$$x = \\frac{-b \\pm \\sqrt{D}}{2a}$$\n\nИли с текстом:\nПодставим в формулу: $D=b^2-4ac$"
                      }
                      className="ui-input min-h-[138px] w-full rounded-[8px] px-4 py-3 text-sm outline-none transition focus:-translate-y-[1px]"
                      disabled={item.isSavingAnswer || item.isDeletingAnswer}
                    />
                    <p className="ui-hint text-xs leading-5 text-[var(--theme-text-muted)]">
                      Поддерживаются inline-формулы через <code>$...$</code> и отдельные блоки через <code>$$...$$</code>.
                    </p>
                  </label>

                  {item.draftAnswerLatex.trim() ? (
                    <div className="ui-panel-soft rounded-[8px] p-3">
                      <p className="text-xs font-medium tracking-[0.18em] text-[var(--theme-text-soft)]">Предпросмотр ответа</p>
                      <div className="mt-2.5">
                        <LatexAnswerPreview value={item.draftAnswerLatex} />
                      </div>
                    </div>
                  ) : (
                    <div className="ui-hint ui-panel-soft rounded-[8px] border-dashed px-4 py-5 text-sm leading-6 text-[var(--theme-text-muted)]">
                      Пока ответ к этому номеру не добавлен.
                    </div>
                  )}

                  {item.answerError ? (
                    <div className="ui-notice-error rounded-[8px] px-4 py-4 text-sm font-medium">{item.answerError}</div>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void saveAnswer(item.id)}
                      disabled={item.isSavingAnswer || item.isDeletingAnswer || !item.draftAnswerLatex.trim()}
                      className="ui-pressable ui-button-primary rounded-[12px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                    >
                      {item.isSavingAnswer ? "Сохраняем..." : "Сохранить ответ"}
                    </button>

                    {item.savedAnswerLatex ? (
                      <button
                        type="button"
                        onClick={() => void removeAnswer(item.id)}
                        disabled={item.isDeletingAnswer || item.isSavingAnswer}
                        className="ui-pressable ui-button-danger rounded-[12px] px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {item.isDeletingAnswer ? "Удаляем..." : "Удалить ответ"}
                      </button>
                    ) : null}
                  </div>
                </section>
              </div>
            </article>
          );
        })}
      </div>

      {pageCount > 1 ? (
        <div className="ui-panel-soft flex flex-wrap items-center justify-between gap-3 rounded-[10px] px-4 py-4">
          <p className="text-sm text-[var(--theme-text-muted)]">
            Страница {currentPage} из {pageCount}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Предыдущая страница
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
              className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              Следующая страница
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
