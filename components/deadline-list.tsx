"use client";

import Link from "next/link";
import { type StudentDeadlineAssignment } from "@/lib/student-deadline-groups";
import { formatDateTime } from "@/lib/utils";

type DeadlineListProps = {
  items: StudentDeadlineAssignment[];
  emptyMessage?: string;
  compact?: boolean;
};

function getNumberWord(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return "номер";
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "номера";
  }

  return "номеров";
}

function getDeadlineUi(item: StudentDeadlineAssignment, now: number) {
  const deadlineTime = new Date(item.deadlineAt).getTime();
  const isSolved = item.status === "DONE";
  const isOverdue = !isSolved && deadlineTime < now;
  const isSoon = !isOverdue && deadlineTime - now <= 1000 * 60 * 60 * 24 * 2;

  if (isOverdue) {
    return {
      statusLabel: "Просрочено",
      statusClassName: "border-rose-200 bg-rose-50 text-rose-700"
    };
  }

  if (item.status === "DONE") {
    return {
      statusLabel: "Сдано",
      statusClassName: "border-emerald-200 bg-emerald-50 text-emerald-700"
    };
  }

  if (item.status === "IN_PROGRESS") {
    return {
      statusLabel: isSoon ? "Скоро дедлайн" : "В работе",
      statusClassName: isSoon ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-700"
    };
  }

  return {
    statusLabel: isSoon ? "Скоро дедлайн" : "Не начато",
    statusClassName: isSoon ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-700"
  };
}

export function DeadlineList({ items, emptyMessage = "На эту дату дедлайнов нет.", compact = false }: DeadlineListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-[var(--theme-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  const now = Date.now();

  return (
    <ul className={compact ? "space-y-2" : "space-y-3"}>
      {items.map((item) => {
        const ui = getDeadlineUi(item, now);

        return (
          <li key={item.id} className="ui-surface rounded-[14px] border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-[var(--theme-text-strong)]">{item.topicTitle}</p>
                <p className="text-sm text-[var(--theme-text-muted)]">
                  ДЗ: {item.solvedNumbers} из {item.totalNumbers} выполнено ({item.totalNumbers} {getNumberWord(item.totalNumbers)})
                </p>
              </div>
              <span className={`inline-flex rounded-[10px] border px-2.5 py-1 text-xs font-semibold ${ui.statusClassName}`}>
                {ui.statusLabel}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--theme-text-muted)]">{formatDateTime(item.deadlineAt)}</p>
              {!compact ? (
                <Link
                  href={`/student/topics/${item.topicId}`}
                  className="ui-pressable ui-button-secondary inline-flex rounded-[10px] px-2.5 py-1.5 text-xs font-semibold"
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
