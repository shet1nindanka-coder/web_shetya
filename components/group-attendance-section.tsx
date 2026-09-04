"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ATTENDANCE_META, nextAttendance, summarizeAttendance, type AttendanceValue } from "@/lib/attendance";
import { cx } from "@/lib/utils";

/*
 * «Посещаемость» на странице группы: строки — ученики, столбцы — прошедшие
 * занятия группы за учебный год. Отметки ставятся автоматически (вход во
 * вкладку «Урок»/сдача → «был», закрытие урока без активности → «не был»),
 * клик по ячейке переключает отметку вручную.
 */

type AttendanceCell = { participantId: string; attendance: AttendanceValue };

type AttendanceLesson = {
  id: string;
  title: string;
  dateLabel: string;
  dateTitle: string;
  status: "ACTIVE" | "FINISHED";
  cells: Record<string, AttendanceCell | undefined>;
};

type GroupAttendanceSectionProps = {
  groupId: string;
  prefix: string;
  members: Array<{ id: string; name: string }>;
  lessons: AttendanceLesson[];
};

// Был/не был — прямой сигнал, статусная палитра уместна; «опоздал» — жёлтая,
// «уважительная» — нейтральная, чтобы не читалась как оценка.
const cellStyle: Record<AttendanceValue, { background: string; color: string; border?: string }> = {
  PRESENT: { background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" },
  LATE: { background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" },
  ABSENT: { background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" },
  EXCUSED: { background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" },
  UNKNOWN: { background: "transparent", color: "var(--shbz-text-soft)", border: "1px dashed var(--shbz-soft-border)" }
};

export function GroupAttendanceSection({ groupId, prefix, members, lessons }: GroupAttendanceSectionProps) {
  const [overrides, setOverrides] = useState<Record<string, AttendanceValue>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valueOf = useCallback(
    (cell: AttendanceCell | undefined) => (cell ? (overrides[cell.participantId] ?? cell.attendance) : null),
    [overrides]
  );

  const toggle = useCallback(
    async (lessonId: string, cell: AttendanceCell) => {
      const current = overrides[cell.participantId] ?? cell.attendance;
      const next = nextAttendance(current);

      setOverrides((state) => ({ ...state, [cell.participantId]: next }));
      setBusyId(cell.participantId);
      setError(null);

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lessonId}/participants/${cell.participantId}/attendance`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attendance: next })
          }
        );
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Не удалось сохранить отметку.");
        }
      } catch (saveError) {
        setOverrides((state) => ({ ...state, [cell.participantId]: current }));
        setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить отметку.");
      } finally {
        setBusyId(null);
      }
    },
    [overrides]
  );

  const summaries = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          summarizeAttendance(
            lessons
              .map((lesson) => valueOf(lesson.cells[member.id]))
              .filter((value): value is AttendanceValue => value !== null)
          )
        ])
      ),
    [members, lessons, valueOf]
  );

  const pdfLinks = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
        PDF:
      </span>
      {(
        [
          ["7d", "7 дней"],
          ["30d", "30 дней"],
          ["year", "учебный год"]
        ] as const
      ).map(([period, label]) => (
        <a
          key={period}
          href={`${prefix}/groups/${groupId}/export/pdf?period=${period}`}
          className="shbz-btn-outline inline-block no-underline"
        >
          {label}
        </a>
      ))}
    </div>
  );

  if (members.length === 0 || lessons.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          {members.length === 0
            ? "Посещаемость появится, когда в группе будут ученики."
            : "Прошедших занятий с назначенным временем у группы пока нет — таблица появится после первого урока."}
        </p>
        {lessons.length > 0 ? pdfLinks : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="ui-hint text-xs" style={{ color: "var(--shbz-kicker)" }}>
          Отметки ставятся сами по активности на уроке; клик по ячейке переключает: был → опоздал → не был →
          по уважительной.
        </p>
        {pdfLinks}
      </div>

      {error ? <div className="ui-notice-error rounded-[8px] px-4 py-3 text-sm">{error}</div> : null}

      {/* Правило 1180: таблица прокручивается внутри себя, а не растягивает страницу. */}
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 min-w-[160px] py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-[1.2px]"
                style={{ background: "var(--shbz-card-bg)", color: "var(--shbz-kicker)" }}
              >
                Ученик
              </th>
              {lessons.map((lesson) => (
                <th
                  key={lesson.id}
                  title={lesson.dateTitle}
                  className="min-w-[64px] px-1.5 py-2 text-center text-[11px] font-bold"
                  style={{ color: lesson.status === "ACTIVE" ? "var(--shbz-accent-solid)" : "var(--shbz-kicker)" }}
                >
                  <Link href={`${prefix}/lessons/${lesson.id}`} className="no-underline" style={{ color: "inherit" }}>
                    {lesson.dateLabel}
                  </Link>
                </th>
              ))}
              <th
                className="min-w-[110px] px-2 py-2 text-right text-[11px] font-bold uppercase tracking-[1.2px]"
                style={{ color: "var(--shbz-kicker)" }}
              >
                Итого
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const summary = summaries.get(member.id);

              return (
                <tr key={member.id} className="border-t" style={{ borderColor: "var(--shbz-row-border)" }}>
                  <td
                    className="sticky left-0 z-10 py-2 pr-3 font-semibold"
                    style={{ background: "var(--shbz-card-bg)", color: "var(--shbz-text-strong)" }}
                  >
                    {member.name}
                  </td>
                  {lessons.map((lesson) => {
                    const cell = lesson.cells[member.id];
                    const value = valueOf(cell);

                    if (!cell || value === null) {
                      return (
                        <td key={lesson.id} className="px-1.5 py-1.5 text-center" style={{ color: "var(--shbz-text-soft)" }}>
                          <span title="не участвовал в занятии">·</span>
                        </td>
                      );
                    }

                    const style = cellStyle[value];

                    return (
                      <td key={lesson.id} className="px-1.5 py-1.5 text-center">
                        <button
                          type="button"
                          disabled={busyId === cell.participantId}
                          onClick={() => void toggle(lesson.id, cell)}
                          aria-label={`${member.name}, ${lesson.dateLabel}: ${ATTENDANCE_META[value].label}`}
                          title={ATTENDANCE_META[value].label}
                          className={cx(
                            "min-w-[56px] rounded-[8px] px-2 py-1 text-[12px] font-bold transition hover:opacity-80 disabled:opacity-60"
                          )}
                          style={{ background: style.background, color: style.color, border: style.border ?? "1px solid transparent" }}
                        >
                          {ATTENDANCE_META[value].short}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-right text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                    {summary && summary.counted > 0
                      ? `${summary.attended} / ${summary.counted}${summary.percent !== null ? ` · ${summary.percent}%` : ""}`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
