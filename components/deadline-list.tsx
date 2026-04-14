"use client";

import Link from "next/link";
import { ProgressBar } from "@/components/progress-bar";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";
import { completionPercent, formatDate } from "@/lib/utils";

type DeadlineListProps = {
  items: StudentDeadlineAssignment[];
  emptyMessage?: string;
  compact?: boolean;
};

export function DeadlineList({ items, emptyMessage = "На эту дату дедлайнов нет.", compact = false }: DeadlineListProps) {
  if (items.length === 0) {
    return (
      <div className="ui-panel-soft rounded-[8px] border border-dashed px-3 py-4 text-sm text-[var(--theme-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => {
        const progressPercent = completionPercent(item.solvedNumbers, item.totalNumbers);
        const progressLabel =
          progressPercent === 100
            ? "ДЗ выполнено полностью"
            : progressPercent === 0
            ? "ДЗ ещё не начато"
            : `Прогресс ДЗ: ${progressPercent}%`;
        const deadlineLabel = `ДЗ до ${formatDate(item.deadlineAt)}`;

        return (
          <li key={item.id} className="ui-surface rounded-[8px] border p-3 sm:p-3.5">
            <div className={compact ? "min-w-0 space-y-2" : "space-y-3"}>
              <div className={compact ? "min-w-0" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-[var(--theme-text-strong)]">{item.topicTitle}</p>
                  <p className="mt-1 text-sm text-[var(--theme-text-muted)]">
                    {deadlineLabel} · Выполнено {item.solvedNumbers} из {item.totalNumbers}
                  </p>
                </div>

                {!compact ? (
                  <Link
                    href={`/student/topics/${item.topicId}`}
                    className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[10px] px-2.5 py-1.5 text-xs font-semibold sm:w-auto sm:shrink-0"
                  >
                    Открыть ДЗ
                  </Link>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <ProgressBar value={progressPercent} size="sm" />
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[var(--theme-text-muted)]">{progressLabel}</span>
                  <span className="font-semibold text-[var(--theme-text-default)]">
                    {item.solvedNumbers}/{item.totalNumbers}
                  </span>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
