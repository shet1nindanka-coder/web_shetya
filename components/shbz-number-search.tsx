"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ShbzNumberSearchProps = {
  endpoint: string;
  placeholder?: string;
};

export function ShbzNumberSearch({
  endpoint,
  placeholder = "Найти номер"
}: ShbzNumberSearchProps) {
  const router = useRouter();
  const [numberQuery, setNumberQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();

        // Номер уходит строкой как набран: ведущие нули значимы («051001»),
        // сервер сам ищет по нормализованному виду.
        const nextNumber = numberQuery.trim();

        if (!/^\d+$/.test(nextNumber) || /^0+$/.test(nextNumber)) {
          setFeedback("Введите корректный номер.");
          return;
        }

        setFeedback(null);

        startTransition(async () => {
          try {
            const response = await fetch(`${endpoint}?number=${encodeURIComponent(nextNumber)}`, {
              method: "GET",
              cache: "no-store"
            });
            const result = (await response.json().catch(() => null)) as { href?: string; error?: string } | null;

            if (!response.ok || !result?.href) {
              setFeedback(result?.error ?? "Не удалось найти тему по этому номеру.");
              return;
            }

            router.push(result.href);
          } catch {
            setFeedback("Не удалось найти тему по этому номеру.");
          }
        });
      }}
    >
      <label className="shbz-search">
        <span className="sr-only">{placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--shbz-kicker)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="search"
          value={numberQuery}
          onChange={(event) => {
            setNumberQuery(event.target.value.replace(/[^\d]/g, ""));
            if (feedback) {
              setFeedback(null);
            }
          }}
          placeholder={isPending ? "Ищем номер..." : placeholder}
          aria-label="Найти номер и открыть тему"
          disabled={isPending}
        />
        {numberQuery.length > 0 ? (
          <button
            type="submit"
            disabled={isPending}
            aria-label="Найти"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "var(--shbz-accent-grad)", opacity: isPending ? 0.55 : 1 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        ) : null}
      </label>
      {feedback ? (
        <p className="text-xs font-medium" style={{ color: "var(--shbz-red-text)" }}>
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
