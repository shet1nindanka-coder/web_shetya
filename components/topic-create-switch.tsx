"use client";

import { useState, type ReactNode } from "react";

/*
 * Переключатель способа создания темы на странице «Темы»: импорт из задачника
 * через ИИ или ручная форма с файлами. Обе панели приходят с сервера готовыми
 * (форме нужны серверные пропсы), здесь только выбор, что показать. Обе остаются
 * смонтированными (hidden) — переключение не теряет введённое и загруженный файл.
 */

const MODES = [
  { key: "ai", label: "С помощью ИИ" },
  { key: "manual", label: "Вручную" }
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export function TopicCreateSwitch({ aiImport, manual }: { aiImport: ReactNode; manual: ReactNode }) {
  // Контент сейчас наливают импортом — он и есть основной путь.
  const [mode, setMode] = useState<ModeKey>("ai");

  return (
    <>
      <div className="shbz-seg mb-5 inline-flex" role="group" aria-label="Способ создания темы">
        {MODES.map((option) => (
          <button
            key={option.key}
            type="button"
            data-active={mode === option.key}
            onClick={() => setMode(option.key)}
            className="shbz-seg-btn shbz-seg-btn--plain"
          >
            {option.label}
          </button>
        ))}
      </div>

      <div hidden={mode !== "ai"}>{aiImport}</div>
      <div hidden={mode !== "manual"}>{manual}</div>
    </>
  );
}
