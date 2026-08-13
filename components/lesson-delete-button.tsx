"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteButton } from "@/components/delete-button";

/*
 * Удаление занятия из списка уроков (не заходя на доску). Тот же DELETE-роут,
 * что и кнопка на доске урока; после удаления список обновляется на месте.
 */

export function LessonDeleteButton({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <DeleteButton
        variant="sm"
        label="Удалить"
        title="Удалить урок?"
        description="Занятие и все подобранные наборы задач будут удалены. Проставленные итоги по номерам у учеников сохранятся. Это действие нельзя отменить."
        onConfirm={async () => {
          const response = await fetch(`/api/teacher/lessons/${lessonId}`, { method: "DELETE" });

          if (!response.ok) {
            const result = (await response.json().catch(() => null)) as { error?: string } | null;
            throw new Error(result?.error || "Не удалось удалить урок.");
          }

          setError(null);
          router.refresh();
        }}
        onError={(cause) => setError(cause instanceof Error ? cause.message : "Не удалось удалить урок.")}
      />
      {error ? (
        <span className="text-xs font-semibold" style={{ color: "var(--shbz-danger-solid)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
