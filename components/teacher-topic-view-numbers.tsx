"use client";

import { LatexAnswerPreview } from "@/components/latex-answer-preview";

type TeacherTopicViewNumbersProps = {
  numbers: Array<{
    id: string;
    number: number;
    conditionLatex: string | null;
    answerLatex: string | null;
  }>;
};

export function TeacherTopicViewNumbers({ numbers }: TeacherTopicViewNumbersProps) {
  if (numbers.length === 0) {
    return (
      <div className="ui-panel-soft rounded-[28px] border-dashed px-5 py-10 text-center">
        <p className="font-display text-2xl font-semibold text-[var(--theme-text-strong)]">Номера пока не добавлены</p>
        <p className="ui-copy-muted mt-2 text-sm">Добавьте номера во вкладке «Редактирование».</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {numbers.map((number) => (
        <article key={number.id} className="teacher-number-card rounded-[10px] border px-4 py-4">
          <p className="teacher-number-title text-lg font-semibold text-[var(--theme-text-strong)]">№ {number.number}</p>

          {number.conditionLatex ? (
            <div className="mt-3">
              <p className="ui-form-label">Условие</p>
              <div className="mt-1.5">
                <LatexAnswerPreview value={number.conditionLatex} />
              </div>
            </div>
          ) : (
            <p className="ui-copy-muted mt-3 text-sm">Условие не добавлено.</p>
          )}

          {number.answerLatex ? (
            <details className="mt-3">
              <summary className="ui-pressable cursor-pointer list-none text-sm font-semibold text-[var(--theme-accent-text)] [&::-webkit-details-marker]:hidden">
                Показать ответ
              </summary>
              <div className="mt-2">
                <LatexAnswerPreview value={number.answerLatex} />
              </div>
            </details>
          ) : (
            <p className="ui-copy-muted mt-3 text-sm">Ответ не добавлен.</p>
          )}
        </article>
      ))}
    </div>
  );
}
