"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/*
 * Сетка тем с перетаскиванием (только разработчик): порядок меняется drag-and-drop,
 * целиком уходит в /api/teacher/topics/order. Карточки приходят с сервера готовыми
 * (ReactNode), здесь — только порядок и отправка. Оптимистично: на ошибке порядок
 * откатывается к серверному. HTML5 DnD не работает на тач-экранах — на телефоне
 * порядок меняется с десктопа, это осознанное упрощение.
 */

type ReorderItem = {
  id: string;
  card: ReactNode;
};

export function TopicReorderGrid({ items }: { items: ReorderItem[] }) {
  const serverOrder = useMemo(() => items.map((item) => item.id), [items]);
  const [order, setOrder] = useState<string[]>(serverOrder);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Сервер прислал новый список (создали/удалили тему) — забываем локальный порядок.
  useEffect(() => {
    setOrder(serverOrder);
  }, [serverOrder]);

  const cardById = useMemo(() => new Map(items.map((item) => [item.id, item.card])), [items]);

  async function commit(nextOrder: string[]) {
    setError(null);

    try {
      const response = await fetch("/api/teacher/topics/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedTopicIds: nextOrder })
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Не удалось сохранить порядок тем.");
      }

      router.refresh();
    } catch (cause) {
      setOrder(serverOrder);
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить порядок тем.");
    }
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setOverId(null);
      return;
    }

    const next = order.filter((id) => id !== dragId);
    next.splice(next.indexOf(targetId) + (order.indexOf(dragId) < order.indexOf(targetId) ? 1 : 0), 0, dragId);
    setDragId(null);
    setOverId(null);
    setOrder(next);
    void commit(next);
  }

  return (
    <>
      {error ? <div className="shbz-notice-error mb-4 px-5 py-3.5 text-sm font-medium">{error}</div> : null}
      <p className="ui-hint mb-4 text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
        Перетащите карточку, чтобы изменить порядок тем — его видят и ученики.
      </p>
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        {order.map((id) => (
          <div
            key={id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              setDragId(id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";

              if (overId !== id) {
                setOverId(id);
              }
            }}
            onDragLeave={() => setOverId((current) => (current === id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              drop(id);
            }}
            className="cursor-grab active:cursor-grabbing"
            style={{
              opacity: dragId === id ? 0.45 : 1,
              borderRadius: 16,
              outline: overId === id && dragId && dragId !== id ? "2px solid var(--shbz-accent-solid)" : "none",
              outlineOffset: 3,
              transition: "opacity 0.15s"
            }}
          >
            {cardById.get(id)}
          </div>
        ))}
      </div>
    </>
  );
}
