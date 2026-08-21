"use client";

import { useRef, useState, useTransition } from "react";
import { setStudentAiProfileAction } from "@/actions/group";
import { ShbzSelect } from "@/components/shbz-select";

type GroupMemberEditorProps = {
  studentId: string;
  speed: number | null;
  aiNote: string | null;
};

const SPEED_OPTIONS = [
  { value: "", label: "Не указана" },
  ...Array.from({ length: 10 }, (_, index) => ({
    value: String(index + 1),
    label: `${index + 1} из 10`
  }))
];

/** Инлайн-поля «скорость» и «заметка для ИИ» с автосохранением. */
export function GroupMemberEditor({ studentId, speed, aiNote }: GroupMemberEditorProps) {
  const [currentSpeed, setCurrentSpeed] = useState(speed ? String(speed) : "");
  const [note, setNote] = useState(aiNote ?? "");
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);
  const [isPending, startTransition] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNote = useRef(aiNote ?? "");

  const save = (nextSpeed: string, nextNote: string) => {
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("speed", nextSpeed);
    formData.set("aiNote", nextNote);

    startTransition(async () => {
      const result = await setStudentAiProfileAction(formData);
      lastSavedNote.current = nextNote;
      setFlash(result.ok ? "saved" : "error");

      if (flashTimer.current) {
        clearTimeout(flashTimer.current);
      }

      flashTimer.current = setTimeout(() => setFlash(null), 2200);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2.5 text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        Скорость
        <div style={{ width: 130 }}>
          <ShbzSelect
            size="xs"
            ariaLabel="Скорость ученика"
            value={currentSpeed}
            options={SPEED_OPTIONS}
            onChange={(nextValue) => {
              setCurrentSpeed(nextValue);
              save(nextValue, note);
            }}
          />
        </div>
      </label>

      <label className="flex min-w-[220px] flex-1 items-center gap-2.5 text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        Заметка для ИИ
        <input
          type="text"
          value={note}
          maxLength={300}
          placeholder="Например: теряется в длинных выкладках"
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => {
            if (note !== lastSavedNote.current) {
              save(currentSpeed, note);
            }
          }}
          className="shbz-input flex-1"
          style={{ height: 40, fontSize: 13.5 }}
        />
      </label>

      <span
        aria-live="polite"
        className="w-[86px] text-xs font-medium"
        style={{
          color: flash === "error" ? "var(--shbz-danger-text)" : "var(--shbz-green-text)",
          opacity: isPending || flash ? 1 : 0,
          transition: "opacity 0.2s"
        }}
      >
        {isPending ? "Сохраняем…" : flash === "saved" ? "Сохранено" : flash === "error" ? "Ошибка" : ""}
      </span>
    </div>
  );
}
