"use client";

import { useState } from "react";
import { ShbzSelect } from "@/components/shbz-select";

export type LessonBankTopic = {
  topicId: string;
  topicTitle: string;
  numbers: Array<{ id: string; number: number; difficulty: number | null }>;
};

/** Ручное добавление номера в набор урока: тема → номер → в основную или доп. часть. */
export function LessonManualAdd({
  bank,
  busy,
  existingIds,
  onAdd
}: {
  bank: LessonBankTopic[];
  busy: boolean;
  existingIds: string[];
  onAdd: (homeworkNumberId: string, toExtra: boolean) => void;
}) {
  const [topicId, setTopicId] = useState(bank[0]?.topicId ?? "");
  const [numberId, setNumberId] = useState("");

  const topic = bank.find((entry) => entry.topicId === topicId) ?? null;
  const existing = new Set(existingIds);
  const numberOptions = (topic?.numbers ?? [])
    .filter((number) => !existing.has(number.id))
    .map((number) => ({
      value: number.id,
      label: number.difficulty ? `№ ${number.number} · сложн. ${number.difficulty}` : `№ ${number.number}`
    }));

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        Добавить номер
      </span>
      <div style={{ width: 220 }}>
        <ShbzSelect
          size="xs"
          ariaLabel="Тема"
          value={topicId}
          options={bank.map((entry) => ({ value: entry.topicId, label: entry.topicTitle }))}
          onChange={(nextValue) => {
            setTopicId(nextValue);
            setNumberId("");
          }}
        />
      </div>
      <div style={{ width: 190 }}>
        <ShbzSelect
          size="xs"
          ariaLabel="Номер"
          value={numberId}
          placeholder="Выберите номер"
          options={numberOptions}
          onChange={setNumberId}
        />
      </div>
      <button
        type="button"
        disabled={busy || !numberId}
        onClick={() => {
          if (numberId) {
            onAdd(numberId, false);
            setNumberId("");
          }
        }}
        className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
      >
        В основную
      </button>
      <button
        type="button"
        disabled={busy || !numberId}
        onClick={() => {
          if (numberId) {
            onAdd(numberId, true);
            setNumberId("");
          }
        }}
        className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
      >
        В доп. ⭐
      </button>
    </div>
  );
}
