"use client";

import { HomeworkNumberStatus } from "@prisma/client";
import { HomeworkStatusBadge } from "@/components/homework-status-badge";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { cx } from "@/lib/utils";

/*
 * Карточка выбора номера в сетках «Составить занятие вручную» и «Выдать ДЗ».
 * Кнопка-выбор растянута на всю карточку и лежит под контентом; блок условия
 * интерактивен (выделение текста, скролл широкой формулы), поэтому клики по
 * нему не переключают выбор. Условие показывается целиком всегда — решение
 * владельца. Фокус-кольцо рисуется внутрь карточки: contain: paint на
 * .teacher-number-card обрезал бы внешний outline.
 *
 * Акцентные токены двух досок исторически разные (--shbz-* и --theme-*) —
 * карточка принимает вариант снаружи, чтобы не менять инкумбентный вид.
 */

const ACCENTS = {
  shbz: {
    ring: "ring-[var(--shbz-accent-solid)]",
    outline: "focus-visible:outline-[var(--shbz-accent-solid)]",
    checkSelected:
      "border-[var(--shbz-accent-solid)] bg-[var(--shbz-green-soft)] text-[var(--shbz-green-text)]",
    checkIdle: "border-[var(--shbz-input-border)] text-transparent"
  },
  theme: {
    ring: "ring-[var(--theme-accent-border)]",
    outline: "focus-visible:outline-[var(--theme-accent-border)]",
    checkSelected:
      "border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-text)]",
    checkIdle: "border-[var(--theme-border)] text-transparent"
  }
} as const;

type NumberSelectCardProps = {
  number: string;
  status: HomeworkNumberStatus | null;
  isSelected: boolean;
  onToggle: () => void;
  conditionLatex?: string | null;
  /** Строка под условием, например «Уже был на занятии» — попадает и в aria-имя кнопки. */
  footnote?: string | null;
  accent: keyof typeof ACCENTS;
};

export function NumberSelectCard({
  number,
  status,
  isSelected,
  onToggle,
  conditionLatex,
  footnote,
  accent
}: NumberSelectCardProps) {
  const accentClasses = ACCENTS[accent];

  return (
    <div
      data-active={isSelected ? "true" : undefined}
      className={cx(
        "teacher-number-card ui-pressable relative rounded-[16px] border px-4 py-4 text-left transition",
        isSelected && cx("ring-2", accentClasses.ring)
      )}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`Выбрать № ${number}${footnote ? ` — ${footnote.toLowerCase()}` : ""}`}
        onClick={onToggle}
        className={cx(
          "absolute inset-0 rounded-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2",
          accentClasses.outline
        )}
      />
      <div className="pointer-events-none relative">
        <div className="flex items-center justify-between gap-3">
          <span
            className={cx(
              "inline-flex h-5 w-5 items-center justify-center rounded-[5px] border text-xs font-bold",
              isSelected ? accentClasses.checkSelected : accentClasses.checkIdle
            )}
            aria-hidden="true"
          >
            ✓
          </span>
          <HomeworkStatusBadge status={status} />
        </div>
        <p className="teacher-number-title mt-3 text-lg font-semibold text-[var(--shbz-text-strong)]">
          № {number}
        </p>
        {conditionLatex ? (
          // Содержание задания, чтобы выбирать не вслепую. Блок интерактивный:
          // текст можно выделять, широкую формулу — скроллить.
          <div className="pointer-events-auto mt-2 text-left text-sm">
            <LatexAnswerPreview value={conditionLatex} />
          </div>
        ) : null}
        {footnote ? <p className="ui-copy-muted mt-2 text-xs leading-5">{footnote}</p> : null}
      </div>
    </div>
  );
}
