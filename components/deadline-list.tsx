"use client";

import Link from "next/link";
import { completionPercent, formatDate, isHomeworkOverdue } from "@/lib/utils";

export type DeadlineListItem = {
  id: string;
  label: string;
  href: string;
  deadlineAt: string;
  totalNumbers: number;
  solvedNumbers: number;
  status: "DONE" | "IN_PROGRESS" | "NOT_STARTED";
};

export function HomeworkDoneBadge() {
  return (
    <span
      className="rounded-[8px] border px-2.5 py-0.5 text-[11.5px] font-bold"
      style={{
        background: "var(--shbz-green-soft)",
        borderColor: "transparent",
        color: "var(--shbz-green-text)"
      }}
    >
      Выполнено
    </span>
  );
}

export function HomeworkOverdueBadge() {
  return (
    <span
      className="rounded-[8px] border px-2.5 py-0.5 text-[11.5px] font-bold"
      style={{
        background: "var(--shbz-danger-bg)",
        borderColor: "transparent",
        color: "var(--shbz-danger-text)"
      }}
    >
      Просрочено
    </span>
  );
}

type DeadlineListProps = {
  items: DeadlineListItem[];
  emptyMessage?: string;
  compact?: boolean;
};

export function DeadlineList({ items, emptyMessage = "На эту дату дедлайнов нет.", compact = false }: DeadlineListProps) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-[8px] px-3.5 py-2 text-[13px] font-medium"
        style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", display: "inline-block" }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={compact ? "space-y-2" : "space-y-4"}>
      {items.map((item) => {
        const progressPercent = completionPercent(item.solvedNumbers, item.totalNumbers);
        const progressLabel =
          progressPercent === 100
            ? "ДЗ выполнено полностью"
            : progressPercent === 0
              ? "ДЗ ещё не начато"
              : `Прогресс ДЗ: ${progressPercent}%`;
        const metaLabel = `ДЗ до ${formatDate(item.deadlineAt)} · Выполнено ${item.solvedNumbers} из ${item.totalNumbers}`;

        if (compact) {
          return (
            <li
              key={item.id}
              className="rounded-[12px] border px-4 py-3.5"
              style={{ borderColor: "var(--shbz-soft-border)", background: "var(--shbz-card-bg)" }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {item.label}
                </span>
                {item.status === "DONE" ? <HomeworkDoneBadge /> : null}
                {isHomeworkOverdue(item.deadlineAt, item.status === "DONE") ? <HomeworkOverdueBadge /> : null}
              </div>
              <div className="mt-1.5 text-[13px] leading-[1.45]" style={{ color: "var(--shbz-text-muted)" }}>
                {metaLabel}
              </div>
              <div className="mt-3 shbz-progress-track" style={{ height: 7 }}>
                <div className="shbz-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[12.5px] font-semibold" style={{ color: "var(--shbz-kicker)" }}>
                  {progressLabel}
                </span>
                <span className="text-[13px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {item.solvedNumbers}/{item.totalNumbers}
                </span>
              </div>
            </li>
          );
        }

        return (
          <li key={item.id} className="shbz-card px-[26px] py-6" style={{ borderRadius: 16 }}>
            <div className="mb-[18px] flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[19px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
                    {item.label}
                  </span>
                  {item.status === "DONE" ? <HomeworkDoneBadge /> : null}
                  {isHomeworkOverdue(item.deadlineAt, item.status === "DONE") ? <HomeworkOverdueBadge /> : null}
                </div>
                <div className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                  {metaLabel}
                </div>
              </div>
              <Link href={item.href} className="shbz-btn-primary shrink-0 px-6 py-3 text-[14.5px]">
                Открыть ДЗ
              </Link>
            </div>
            <div className="shbz-progress-track">
              <div className="shbz-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
