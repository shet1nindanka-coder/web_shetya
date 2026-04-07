"use client";

import { useFormStatus } from "react-dom";

export function TopicEditSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="ui-pressable ui-button-primary rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
      >
        {pending ? "Сохраняем изменения..." : "Сохранить изменения"}
      </button>

      <p
        aria-live="polite"
        className="ui-hint min-h-[1.25rem] text-sm text-slate-500"
      >
        {pending ? "Файлы и номера обновляются. Не закрывайте страницу." : ""}
      </p>
    </div>
  );
}
