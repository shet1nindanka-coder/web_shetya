"use client";

import { useState } from "react";
import { TeacherLessonComposeBoard } from "@/components/teacher-lesson-compose-board";
import { TeacherLessonCreateForm } from "@/components/teacher-lesson-create-form";

type ComposeBoardTopics = Parameters<typeof TeacherLessonComposeBoard>[0]["topics"];

type TeacherLessonComposeSwitchProps = {
  prefix: string;
  student: { id: string; name: string; speed: number | null };
  formTopics: Array<{ id: string; title: string }>;
  boardTopics: ComposeBoardTopics;
  aiAvailable: boolean;
};

/**
 * Составление занятия: по умолчанию ИИ-подбор, кнопкой переключается
 * на ручной выбор номеров (решение владельца). Если ИИ выключен —
 * сразу ручной режим.
 */
export function TeacherLessonComposeSwitch({
  prefix,
  student,
  formTopics,
  boardTopics,
  aiAvailable
}: TeacherLessonComposeSwitchProps) {
  const [mode, setMode] = useState<"ai" | "manual">(aiAvailable ? "ai" : "manual");

  return (
    <div className="space-y-6">
      <div className="shbz-seg inline-flex" role="group" aria-label="Способ составления занятия">
        <button
          type="button"
          data-active={mode === "ai"}
          aria-pressed={mode === "ai"}
          disabled={!aiAvailable}
          title={aiAvailable ? undefined : "ИИ-подбор сейчас недоступен"}
          onClick={() => setMode("ai")}
          className="shbz-seg-btn shbz-seg-btn--plain disabled:cursor-not-allowed disabled:opacity-50"
        >
          ИИ-подбор
        </button>
        <button
          type="button"
          data-active={mode === "manual"}
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
          className="shbz-seg-btn shbz-seg-btn--plain"
        >
          Выбрать вручную
        </button>
      </div>

      {mode === "ai" ? (
        <TeacherLessonCreateForm prefix={prefix} members={[student]} topics={formTopics} />
      ) : (
        <TeacherLessonComposeBoard studentId={student.id} topics={boardTopics} />
      )}
    </div>
  );
}
