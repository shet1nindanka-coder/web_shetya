"use client";

import { useState } from "react";
import { TOPIC_IMPORT_PROMPT } from "@/lib/topic-import-prompt";

/*
 * Кнопка «Скопировать промпт для ИИ». Вынесена из панели импорта, чтобы на
 * странице «Темы» жить в одной строке с переключателем «С помощью ИИ / Вручную»
 * (вариант А макета), а на странице редактирования темы — внутри панели.
 */

export function TopicImportPromptButton() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(TOPIC_IMPORT_PROMPT);
      setFailed(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition"
        onClick={() => void copyPrompt()}
      >
        Скопировать промпт для ИИ
      </button>
      {copied ? (
        <span className="text-sm font-semibold" style={{ color: "var(--theme-success-text)" }}>
          Скопировано
        </span>
      ) : null}
      {failed ? (
        <span className="text-sm font-semibold" style={{ color: "var(--theme-danger-text)" }}>
          Браузер не дал доступ к буферу обмена
        </span>
      ) : null}
    </span>
  );
}
