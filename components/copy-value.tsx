"use client";

import type { ReactNode } from "react";
import { useCopy } from "@/lib/animation-hooks";

/*
 * Строка со значением, которую можно забрать в буфер одним нажатием (логин,
 * пароль, код). Вся строка — цель нажатия; подложка вспыхивает, над строкой
 * всплывает пилюля «Скопировано», скринридеру результат озвучивается словами.
 * Анимация — .ui-copy-row / .ui-copy-pill в app/globals.css, хук useCopy.
 */

type CopyValueProps = {
  value: string;
  /** Как назвать значение для скринридера: «Логин скопирован». */
  label: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
};

export function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CopyValue({ value, label, className, style, children }: CopyValueProps) {
  const { copied, copy } = useCopy();
  const isCopied = copied === "value";

  return (
    <>
      <div
        className={["ui-copy-row inline-flex max-w-full items-center gap-2", className].filter(Boolean).join(" ")}
        style={style}
        data-copied={String(isCopied)}
        role="button"
        tabIndex={0}
        title="Нажмите, чтобы скопировать"
        onClick={() => void copy(value, "value")}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void copy(value, "value");
          }
        }}
      >
        <span className="min-w-0 truncate">{children ?? value}</span>
        <CopyIcon className="ui-copy-icon" />
        <span className="ui-copy-pill">Скопировано</span>
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {isCopied ? `${label} скопирован` : ""}
      </span>
    </>
  );
}
