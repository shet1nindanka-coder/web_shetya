import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import {
  EGE_BASE_GRADES,
  EGE_BASE_MAX_PRIMARY,
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
 * «Общая инфа» ученика: справочник по баллам ЕГЭ (профиль и база) и ОГЭ.
 * Вкладка возвращена по решению владельца (2026-08-22); данные — lib/exam-scores.ts.
 */

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

function GradeList({ items, unit }: { items: GradeRow[]; unit: string }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {items.map((item) => (
        <div
          key={item.grade}
          className="rounded-[16px] border px-5 py-[18px]"
          style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
        >
          <div className="text-[12px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
            Оценка {item.grade}
          </div>
          <div className="mt-1.5 text-[22px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            {item.range} <span className="text-[14px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>{unit}</span>
          </div>
          {item.note ? (
            <div className="mt-1.5 text-[12.5px] leading-[1.45]" style={{ color: "var(--shbz-text-muted)" }}>
              {item.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function StudentInfoPage() {
  return (
    <div>
      <ShbzPageHeader
        kicker="Общая инфа"
        title="Баллы и разбалловка"
        aside={<ShbzNumberSearch endpoint="/api/student/homeworks/find-number" />}
      />

      <section className="mb-11">
        <h2 className="shbz-section-title">ЕГЭ профиль · первичные → тестовые</h2>
        <div className="shbz-card shbz-section-pad">
          <p className="mb-5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Максимум {EGE_PROFILE_MAX_PRIMARY} первичных балла. Порог «сдал» — {EGE_PROFILE_MIN_PRIMARY} первичных (
            {EGE_PROFILE_SCALE[EGE_PROFILE_MIN_PRIMARY - 1].secondary} тестовых).
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

      <section className="mb-11">
        <h2 className="shbz-section-title">ЕГЭ профиль · сколько даёт каждое задание</h2>
        <div className="shbz-card shbz-section-pad">
          <TaskScoringList items={EGE_PROFILE_TASKS} />
        </div>
      </section>

      <section className="mb-11">
        <h2 className="shbz-section-title">ЕГЭ база · оценка по первичным</h2>
        <div className="shbz-card shbz-section-pad">
          <p className="mb-5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            {EGE_BASE_MAX_PRIMARY} задание, каждое — 1 первичный балл. Тестовых баллов нет: ставится школьная оценка.
          </p>
          <GradeList items={EGE_BASE_GRADES} unit="баллов" />
        </div>
      </section>

      <section className="mb-11">
        <h2 className="shbz-section-title">ОГЭ · сколько даёт каждое задание</h2>
        <div className="shbz-card shbz-section-pad">
          <p className="mb-5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            25 заданий, максимум {OGE_MAX_PRIMARY} первичный балл.
          </p>
          <TaskScoringList items={OGE_TASKS} />
        </div>
      </section>

      <section>
        <h2 className="shbz-section-title">ОГЭ · оценка по первичным</h2>
        <div className="shbz-card shbz-section-pad">
          <GradeList items={OGE_GRADES} unit="баллов" />
        </div>
      </section>
    </div>
  );
}
