"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type StudentPortraitPanelProps = {
  studentId: string;
  portrait: string | null;
  updatedAtLabel: string | null;
};

/** ИИ-портрет ученика: виден только учителю, уходит в промпт подбора уроков. */
export function StudentPortraitPanel({ studentId, portrait, updatedAtLabel }: StudentPortraitPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/teacher/students/${studentId}/portrait`, { method: "POST" });
        const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;

        if (!response.ok || !result?.ok) {
          setError(result?.message || "Не удалось обновить портрет.");
          return;
        }

        router.refresh();
      } catch {
        setError("Сеть недоступна. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <details className="shbz-card px-6 py-4" open={Boolean(portrait)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[15px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Портрет ученика (ИИ)
          </span>
          <span className="block text-xs" style={{ color: "var(--shbz-text-muted)" }}>
            {updatedAtLabel ? `обновлён ${updatedAtLabel}` : "ещё не собирался"} · виден только учителю, используется при
            подборе уроков
          </span>
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={(event) => {
            event.preventDefault();
            refresh();
          }}
          className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {isPending ? <span className="shbz-spinner" aria-hidden /> : null}
            {isPending ? "Собираем…" : portrait ? "Обновить портрет" : "Собрать портрет"}
          </span>
        </button>
      </summary>

      {error ? (
        <p className="mt-3 text-sm font-medium" style={{ color: "var(--shbz-danger-text)" }} aria-live="polite">
          {error}
        </p>
      ) : null}

      {portrait ? (
        <p
          className="mt-3 whitespace-pre-line rounded-[12px] px-4 py-3 text-sm leading-6"
          style={{ background: "var(--shbz-soft-bg)", color: "var(--shbz-text-default, var(--shbz-label))" }}
        >
          {portrait}
        </p>
      ) : (
        <p className="mt-3 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          Портрет строится из результатов ИИ-проверок: вердикты, комментарии об ошибках, карта тем. Появятся проверки —
          появится и портрет (обновляется сам после каждых трёх новых).
        </p>
      )}
    </details>
  );
}
