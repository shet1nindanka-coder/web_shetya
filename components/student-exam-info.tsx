"use client";

import { useState } from "react";
import { useTabIndicator } from "@/lib/animation-hooks";
import {
  EGE_PROFILE_MAX_PRIMARY,
  EGE_PROFILE_MIN_PRIMARY,
  EGE_PROFILE_SCALE,
  EGE_PROFILE_TASKS,
  OGE_GRADES,
  OGE_MAX_PRIMARY,
  OGE_TASKS
} from "@/lib/exam-scores";
import type { GradeRow, TaskScoringRow } from "@/lib/exam-scores";

/*
 * «Общая инфа» ученика: переключатель ЕГЭ / ОГЭ (решение владельца 2026-08-22).
 * ЕГЭ — профиль: шкала первичные → тестовые и разбалловка. ОГЭ — разбалловка и
 * оценка по первичным. Данные — lib/exam-scores.ts.
 */

type ExamKind = "ege" | "oge";

const EXAM_OPTIONS: Array<{ key: ExamKind; label: string }> = [
  { key: "ege", label: "ЕГЭ" },
  { key: "oge", label: "ОГЭ" }
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[16px] border px-5 py-[18px]"
      style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
    >
      {children}
    </div>
  );
}

function TaskScoringList({ items }: { items: TaskScoringRow[] }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
      {items.map((item) => (
        <div
          key={item.text}
          className="flex items-center gap-3.5 rounded-[16px] border px-5 py-[18px]"
          style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
        >
          <span
            className="min-w-[44px] shrink-0 rounded-[8px] px-3 py-[7px] text-center text-[13px] font-extrabold text-white"
            style={{ background: "var(--shbz-accent-grad)" }}
          >
            {item.badge}
          </span>
          <span className="text-[15px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
            {item.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function GradeList({ items }: { items: GradeRow[] }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {items.map((item) => (
        <Card key={item.grade}>
          <div className="text-[12px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
            Оценка {item.grade}
          </div>
          <div className="mt-1.5 text-[22px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            {item.range}{" "}
            <span className="text-[14px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
              баллов
            </span>
          </div>
          {item.note ? (
            <div className="mt-1.5 text-[12.5px] leading-[1.45]" style={{ color: "var(--shbz-text-muted)" }}>
              {item.note}
            </div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function EgeContent() {
  return (
    <>
      <section className="mb-11">
        <h2 className="shbz-section-title">Первичные → тестовые</h2>
        <div className="shbz-card shbz-section-pad">
          <p className="mb-5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Профильная математика, максимум {EGE_PROFILE_MAX_PRIMARY} первичных балла. Порог «сдал» —{" "}
            {EGE_PROFILE_MIN_PRIMARY} первичных ({EGE_PROFILE_SCALE[EGE_PROFILE_MIN_PRIMARY - 1].secondary} тестовых).
          </p>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
            {EGE_PROFILE_SCALE.map(({ primary, secondary }) => (
              <div
                key={primary}
                className="flex items-center justify-center gap-2 rounded-[16px] border px-3.5 py-3"
                style={{
                  background: "var(--shbz-soft-bg)",
                  borderColor: primary === EGE_PROFILE_MIN_PRIMARY ? "var(--shbz-accent-solid)" : "var(--shbz-soft-border)"
                }}
              >
                <span className="text-sm font-bold" style={{ color: "var(--shbz-kicker)" }}>
                  {primary}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--shbz-week-dot-off)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
                <span className="text-[17px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {secondary}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="shbz-section-title">Сколько даёт каждое задание</h2>
        <div className="shbz-card shbz-section-pad">
          <TaskScoringList items={EGE_PROFILE_TASKS} />
        </div>
      </section>
    </>
  );
}

function OgeContent() {
  return (
    <>
      <section className="mb-11">
        <h2 className="shbz-section-title">Сколько даёт каждое задание</h2>
        <div className="shbz-card shbz-section-pad">
          <p className="mb-5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            25 заданий, максимум {OGE_MAX_PRIMARY} первичный балл.
          </p>
          <TaskScoringList items={OGE_TASKS} />
        </div>
      </section>

      <section>
        <h2 className="shbz-section-title">Оценка по первичным</h2>
        <div className="shbz-card shbz-section-pad">
          <GradeList items={OGE_GRADES} />
        </div>
      </section>
    </>
  );
}

export function StudentExamInfo() {
  const [exam, setExam] = useState<ExamKind>("ege");
  const activeIndex = EXAM_OPTIONS.findIndex((option) => option.key === exam);
  const { shellRef, indicatorProps } = useTabIndicator<HTMLDivElement>(activeIndex);

  return (
    <div>
      <div ref={shellRef} className="shbz-seg ui-tab-shell--live mb-8" role="tablist" aria-label="Экзамен">
        <span className="ui-tab-indicator" {...indicatorProps} />
        {EXAM_OPTIONS.map((option, index) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            data-tab-index={index}
            className="shbz-seg-btn shbz-seg-btn--plain"
            data-active={option.key === exam}
            aria-selected={option.key === exam}
            onClick={() => setExam(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* key — чтобы панель перепроигрывала вход при смене экзамена (A02). */}
      <div className="ui-tab-panel" key={exam}>
        {exam === "ege" ? <EgeContent /> : <OgeContent />}
      </div>
    </div>
  );
}
