"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ProgressHistoryData } from "@/lib/progress-history";

export function ProgressStatusHistory({ studentId, homeworkNumberId, refreshKey }: {
  studentId: string; homeworkNumberId: string; refreshKey?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ProgressHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const panelId = useId();

  const load = useCallback(async (cursor?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    if (!cursor) setData(null);
    try {
      const params = new URLSearchParams({ studentId, homeworkNumberId, ...(cursor ? { cursor } : {}) });
      const response = await fetch(`/api/teacher/progress-history?${params}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Не удалось загрузить историю. Попробуйте ещё раз.");
      const page = await response.json() as ProgressHistoryData;
      if (!controller.signal.aborted) {
        setData((previous) => cursor && previous ? { ...page, entries: [...previous.entries, ...page.entries] } : page);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Не удалось загрузить историю.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [studentId, homeworkNumberId]);

  useEffect(() => {
    if (open) void load();
    return () => request.current?.abort();
  }, [open, refreshKey, load]);

  return (
    <div className="mt-2 text-sm" onKeyDown={(event) => event.stopPropagation()}>
      <button
        type="button" className="ui-pressable text-[var(--theme-text-muted)] underline underline-offset-4"
        aria-expanded={open} aria-controls={panelId}
        onClick={() => {
          setOpen(!open);
          if (open) { request.current?.abort(); setLoading(false); }
        }}
      >
        {open ? "Скрыть историю статуса" : "История статуса"}
      </button>
      {open ? (
        <div id={panelId} className="ui-panel-soft mt-2 space-y-3 rounded-xl p-3" aria-busy={loading}>
          {data ? (
            <>
              <p className="font-semibold">{data.studentName} · № {data.number} · {data.topicTitle}</p>
              <p>Сейчас: {data.currentStatus}</p>
              {data.entries.length ? (
                <ol className="space-y-3">
                  {data.entries.map((entry) => (
                    <li key={entry.id} className="border-t border-[var(--theme-border-soft)] pt-2">
                      <p className="text-xs text-[var(--theme-text-muted)]">
                        {new Date(entry.createdAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} МСК · {entry.actor}
                      </p>
                      <p>{entry.source}: {entry.previousStatus} → {entry.status}</p>
                      <p className="text-xs text-[var(--theme-text-muted)]">{entry.reason}</p>
                      {entry.reference ? <a href={entry.reference.href} className="underline">{entry.reference.label}</a> : null}
                    </li>
                  ))}
                </ol>
              ) : <p>Записей пока нет. История появится после новой отметки или проверки.</p>}
              <p className="text-xs text-[var(--theme-text-muted)]">Изменения до включения истории не записывались.</p>
            </>
          ) : null}
          {loading ? <p role="status">Загружаем историю…</p> : null}
          {error ? <p role="alert" className="text-[var(--theme-danger-text)]">{error}</p> : null}
          {!loading && (error || data?.nextCursor) ? (
            <button type="button" className="shbz-btn-outline" onClick={() => void load(data?.nextCursor ?? undefined)}>
              {error ? "Повторить" : "Более ранние записи"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
