"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { cx } from "@/lib/utils";

type StudentTopicTabId = "numbers" | "theory" | "homework";

type StudentTopicTabsProps = {
  hasTheoryFile: boolean;
  hasHomeworkFile: boolean;
  numbersContent: ReactNode;
  theoryContent: ReactNode;
  homeworkContent: ReactNode;
};

const tabMeta: Array<{
  id: StudentTopicTabId;
  label: string;
  emptyLabel?: string;
}> = [
  {
    id: "numbers",
    label: "Номера"
  },
  {
    id: "theory",
    label: "Теория",
    emptyLabel: "Нет файла"
  },
  {
    id: "homework",
    label: "Задания",
    emptyLabel: "Нет файла"
  }
];

export function StudentTopicTabs({
  hasTheoryFile,
  hasHomeworkFile,
  numbersContent,
  theoryContent,
  homeworkContent
}: StudentTopicTabsProps) {
  const [activeTab, setActiveTab] = useState<StudentTopicTabId>("numbers");

  const availability = useMemo(
    () => ({
      numbers: true,
      theory: hasTheoryFile,
      homework: hasHomeworkFile
    }),
    [hasHomeworkFile, hasTheoryFile]
  );

  const contentByTab: Record<StudentTopicTabId, ReactNode> = {
    numbers: numbersContent,
    theory: theoryContent,
    homework: homeworkContent
  };

  return (
    <div className="space-y-6">
      <nav className="ui-fade-slide flex flex-wrap gap-2 rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)] backdrop-blur">
        {tabMeta.map((tab) => {
          const isActive = activeTab === tab.id;
          const isAvailable = availability[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-active={isActive}
              className={cx(
                "ui-pressable rounded-full border px-5 py-2.5 text-sm font-medium transition",
                isActive
                  ? "border-brand-200 bg-[linear-gradient(180deg,rgba(239,246,255,1),rgba(219,234,254,0.92))] text-brand-700 shadow-[0_12px_24px_rgba(59,130,246,0.14)]"
                  : "border-slate-200/90 bg-white/92 text-slate-700 hover:border-brand-300 hover:text-brand-700"
              )}
            >
              <span>{tab.label}</span>
              {tab.id !== "numbers" ? (
                <span
                  className={cx(
                    "ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm",
                    isAvailable ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {isAvailable ? "Есть" : tab.emptyLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div key={activeTab} className="ui-fade-slide">
        {contentByTab[activeTab]}
      </div>
    </div>
  );
}
