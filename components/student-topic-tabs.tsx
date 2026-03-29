"use client";

import type { ReactNode } from "react";
import { useState } from "react";
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
}> = [
  {
    id: "numbers",
    label: "Номера"
  },
  {
    id: "theory",
    label: "Теория"
  },
  {
    id: "homework",
    label: "Задания"
  }
];

export function StudentTopicTabs({
  hasTheoryFile: _hasTheoryFile,
  hasHomeworkFile: _hasHomeworkFile,
  numbersContent,
  theoryContent,
  homeworkContent
}: StudentTopicTabsProps) {
  const [activeTab, setActiveTab] = useState<StudentTopicTabId>("numbers");

  const contentByTab: Record<StudentTopicTabId, ReactNode> = {
    numbers: numbersContent,
    theory: theoryContent,
    homework: homeworkContent
  };

  return (
    <div className="space-y-6">
      <nav className="ui-fade-slide ui-tab-shell ui-tab-strip flex gap-2 rounded-[24px] p-2 sm:flex-wrap sm:overflow-visible sm:rounded-[28px] sm:p-2.5">
        {tabMeta.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-active={isActive}
              className={cx("ui-pressable ui-tab shrink-0 rounded-full px-4 py-2.5 text-sm font-medium sm:px-5")}
            >
              <span>{tab.label}</span>
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
