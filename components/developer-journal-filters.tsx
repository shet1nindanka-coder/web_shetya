"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/*
 * Фильтры журнала действий. Применяются сразу при изменении: селекты и чекбокс —
 * мгновенно, текстовое поле «Действие» — с паузой 450 мс, чтобы не дёргать
 * сервер на каждую букву. Кнопки «Показать» нет: состояние фильтров живёт в
 * адресе (ссылку на выборку по-прежнему можно сохранить), страница серверная.
 */

type JournalActor = { id: string; name: string; roleLabel: string };

type DeveloperJournalFiltersProps = {
  category: string;
  actorId: string;
  action: string;
  days: number;
  onlyFailed: boolean;
  actors: JournalActor[];
};

export function DeveloperJournalFilters({
  category,
  actorId,
  action,
  days,
  onlyFailed,
  actors
}: DeveloperJournalFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [actionDraft, setActionDraft] = useState(action);
  const debounceTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    },
    []
  );

  const apply = (overrides: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    next.delete("page"); // смена фильтра всегда возвращает на первую страницу
    startTransition(() => {
      router.replace(`/developer/panel/journal?${next.toString()}`, { scroll: false });
    });
  };

  const onActionInput = (value: string) => {
    setActionDraft(value);
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => apply({ action: value.trim() }), 450);
  };

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      style={isPending ? { opacity: 0.65, transition: "opacity 160ms ease" } : undefined}
      aria-busy={isPending}
    >
      <label className="block">
        <span className="shbz-kicker mb-1 block">Категория</span>
        <select
          value={category}
          onChange={(event) => apply({ category: event.target.value })}
          className="shbz-select w-full"
        >
          <option value="">Все</option>
          <option value="AI">ИИ и расходы</option>
          <option value="DATA">Изменения данных</option>
          <option value="AUTH">Входы</option>
        </select>
      </label>

      <label className="block">
        <span className="shbz-kicker mb-1 block">Кто</span>
        <select value={actorId} onChange={(event) => apply({ actor: event.target.value })} className="shbz-select w-full">
          <option value="">Все</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name} — {actor.roleLabel}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="shbz-kicker mb-1 block">Действие</span>
        <input
          type="text"
          value={actionDraft}
          onChange={(event) => onActionInput(event.target.value)}
          placeholder="lesson_plan"
          maxLength={60}
          className="shbz-input w-full"
        />
      </label>

      <label className="block">
        <span className="shbz-kicker mb-1 block">Период</span>
        <select value={String(days)} onChange={(event) => apply({ days: event.target.value })} className="shbz-select w-full">
          <option value="1">Сутки</option>
          <option value="7">Неделя</option>
          <option value="30">Месяц</option>
          <option value="90">Три месяца</option>
          <option value="0">Всё время</option>
        </select>
      </label>

      <label className="flex items-end gap-2 pb-2 text-[13px]">
        <input
          type="checkbox"
          checked={onlyFailed}
          onChange={(event) => apply({ outcome: event.target.checked ? "failed" : "" })}
          className="shbz-checkbox"
        />
        <span style={{ color: "var(--shbz-text-strong)" }}>Только ошибки</span>
      </label>
    </div>
  );
}
