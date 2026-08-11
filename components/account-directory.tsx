"use client";

import { useState } from "react";
import { AccountStudentsManager } from "@/components/account-students-manager";
import { AccountTeachersManager, type ManagedTeacher } from "@/components/account-teachers-manager";

/*
 * Единый блок «Учителя и ученики» на вкладке «Аккаунты» разработчика:
 * вкладки-сегменты и поиск по имени и логину. Списки со временем становятся
 * длинными, поэтому без фильтра и вкладок страница расползается.
 * Оба списка остаются смонтированными (hidden) — переключение вкладок и поиск
 * не теряют несохранённые правки привязки учеников к учителям.
 */

type Teacher = {
  id: string;
  name: string;
  email: string;
};

type Student = {
  id: string;
  name: string;
  email: string;
  teacherId: string | null;
};

type AccountDirectoryProps = {
  teachers: ManagedTeacher[];
  students: Student[];
  // Формам смены учителя нужен только выбор — без счётчиков.
  teacherOptions: Teacher[];
};

const TABS = [
  { key: "teachers", label: "Учителя" },
  { key: "students", label: "Ученики" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AccountDirectory({ teachers, students, teacherOptions }: AccountDirectoryProps) {
  const [tab, setTab] = useState<TabKey>("teachers");
  const [query, setQuery] = useState("");

  const counts: Record<TabKey, number> = {
    teachers: teachers.length,
    students: students.length
  };

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <nav className="shbz-seg" aria-label="Учителя и ученики">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="shbz-seg-btn"
              data-active={tab === item.key}
              onClick={() => setTab(item.key)}
            >
              {item.label} · {counts[item.key]}
            </button>
          ))}
        </nav>

        <label className="shbz-search">
          <span className="sr-only">Поиск по аккаунтам</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--shbz-kicker)"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            type="text"
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "teachers" ? "Имя или логин учителя" : "Имя или логин ученика"}
            aria-label="Поиск по имени или логину"
          />
        </label>
      </div>

      <div hidden={tab !== "teachers"}>
        <AccountTeachersManager teachers={teachers} searchQuery={query} />
      </div>
      <div hidden={tab !== "students"}>
        <AccountStudentsManager students={students} teachers={teacherOptions} searchQuery={query} />
      </div>
    </>
  );
}
