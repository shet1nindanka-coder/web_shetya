"use client";

import { useState } from "react";
import { createGroupAction } from "@/actions/group";

/** Форма создания группы: кнопка активна только после заполнения названия. */
export function GroupCreateForm() {
  const [name, setName] = useState("");

  return (
    <form action={createGroupAction} className="flex flex-wrap items-start gap-4">
      <label className="block min-w-[240px] flex-1">
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Название
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="9 класс, ОГЭ по субботам"
          className="shbz-input"
        />
      </label>
      <label className="block w-[130px]">
        <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Класс
        </span>
        <input type="number" name="grade" min={1} max={11} step={1} placeholder="—" className="shbz-input" />
      </label>
      <div className="shrink-0">
        {/* Невидимая метка повторяет структуру колонок — кнопка встаёт вровень с полями. */}
        <span className="mb-[9px] block text-[13px] font-semibold opacity-0" aria-hidden="true">
          {" "}
        </span>
        <button
          type="submit"
          disabled={!name.trim()}
          className="shbz-btn-primary inline-flex h-[52px] items-center px-[26px] text-[15px] leading-none"
        >
          Создать группу
        </button>
      </div>
    </form>
  );
}
