"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";

type DeadlineListProps = {
  items: StudentDeadlineAssignment[];
  emptyMessage?: string;
  compact?: boolean;
};

export function DeadlineList({ items, emptyMessage = "На эту дату дедлайнов нет.", compact = false }: DeadlineListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-[var(--theme-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => {
        const progressPercent = item.totalNumbers > 0 ? Math.round((item.solvedNumbers / item.totalNumbers) * 100) : 0;

        return (
          <li key={item.id} className="ui-surface rounded-[14px] border p-3">
            <div className={compact ? "min-w-0" : "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"}>
              <div className={compact ? "min-w-0" : "min-w-0 flex-1 sm:max-w-[660px]"}>
                <p className="font-medium text-[var(--theme-text-strong)]">{item.topicTitle}</p>
                <div className="mt-1.5 space-y-1.5">
                  <ProgressBar value={progressPercent} size="sm" />
                  <p className="text-xs text-[var(--theme-text-muted)]">Прогресс ДЗ: {progressPercent}%</p>
                </div>
              </div>

              {!compact ? (
                <Link
                  href={`/student/topics/${item.topicId}`}
                  className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[10px] px-2.5 py-1.5 text-xs font-semibold sm:w-auto sm:shrink-0"
                >
                  Открыть тему
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
