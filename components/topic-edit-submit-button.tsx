"use client";

import { useFormStatus } from "react-dom";

export function TopicEditSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="ui-pressable rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {pending ? "Сохраняем изменения..." : "Сохранить изменения"}
      </button>

      <p
        aria-live="polite"
        className="min-h-[1.25rem] text-sm text-slate-500"
      >
        {pending ? "Файлы и номера обновляются. Не закрывайте страницу." : ""}
      </p>
    </div>
  );
}
