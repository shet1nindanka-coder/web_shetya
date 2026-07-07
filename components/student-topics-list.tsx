"use client";

import Link from "next/link";
import { useState } from "react";

export type StudentTopicListItem = {
  id: string;
  title: string;
  description: string | null;
  solvedCount: number;
  totalNumbers: number;
  solvedPercent: number;
  isCompleted: boolean;
};

function TopicCard({ topic }: { topic: StudentTopicListItem }) {
  return (
    <article className="shbz-card shbz-card-hover px-[26px] py-6" style={{ borderRadius: 18 }}>
      <div className="mb-[18px] flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
              {topic.title}
            </h2>
            {topic.isCompleted ? (
              <span className="shbz-chip shbz-chip-green hidden sm:inline-block">Тема завершена</span>
            ) : null}
          </div>
          {topic.description ? (
            <p className="ui-hint mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
              {topic.description}
            </p>
          ) : null}
          <p
            className="mt-2 text-sm"
            style={
              topic.isCompleted
                ? { color: "var(--shbz-green-text)", fontWeight: 600 }
                : { color: "var(--shbz-text-muted)" }
            }
          >
            {topic.isCompleted
              ? "Все номера в теме закрыты."
              : `${topic.solvedCount} из ${topic.totalNumbers} задач выполнено`}
          </p>
        </div>

        <Link href={`/student/topics/${topic.id}`} className="shbz-btn-primary shrink-0 px-6 py-3 text-[14.5px]">
          Открыть
        </Link>
      </div>
      <div className="shbz-progress-track">
        <div className="shbz-progress-fill" style={{ width: `${topic.solvedPercent}%` }} />
      </div>
    </article>
  );
}

export function StudentTopicsList({ topics }: { topics: StudentTopicListItem[] }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const activeTopics = topics.filter((topic) => !topic.isCompleted);
  const completedTopics = topics.filter((topic) => topic.isCompleted);

  return (
    <div className="flex flex-col gap-4">
      {activeTopics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}

      {activeTopics.length === 0 && completedTopics.length > 0 ? (
        <div className="shbz-card px-6 py-8 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Все темы завершены — отличная работа!
          </p>
        </div>
      ) : null}

      {completedTopics.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowCompleted((current) => !current)}
            aria-expanded={showCompleted}
            className="shbz-btn-outline mt-1 inline-flex items-center gap-2 self-center px-5 py-2.5 text-sm"
          >
            {showCompleted ? "Скрыть завершённые" : `Показать завершённые (${completedTopics.length})`}
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
              className="transition-transform"
              style={{ transform: showCompleted ? "rotate(180deg)" : "none" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {showCompleted ? completedTopics.map((topic) => <TopicCard key={topic.id} topic={topic} />) : null}
        </>
      ) : null}
    </div>
  );
}
