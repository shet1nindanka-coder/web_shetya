"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { DeleteButton } from "@/components/delete-button";
import { LessonManualAdd } from "@/components/lesson-manual-add";
import { ResultToggle } from "@/components/lesson-result-toggle";

const STALE_PLAN_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 2000;

type LessonBoardItem = {
  id: string;
  homeworkNumberId: string;
  number: string;
  difficulty: number | null;
  reason: string;
  minutes: number | null;
  comment: string | null;
  isExtra: boolean;
  result: string | null;
  topicTitle: string;
  studentStatus: string | null;
};

type LessonBoardParticipant = {
  id: string;
  studentId: string;
  studentName: string;
  speed: number | null;
  planSummary: string | null;
  planGeneratedAt: string | null;
  planError: string | null;
  createdAt: string;
  items: LessonBoardItem[];
};

type TeacherLessonBoardProps = {
  prefix: string;
  aiAvailable: boolean;
  lesson: {
    id: string;
    participants: LessonBoardParticipant[];
  };
  bank: Array<{
    topicId: string;
    topicTitle: string;
    numbers: Array<{ id: string; number: string; difficulty: number | null }>;
  }>;
};

const reasonMeta: Record<string, { label: string; background: string; color: string }> = {
  GAP: { label: "Пробел", background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" },
  REVIEW: { label: "Повторение", background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" },
  NEW: { label: "Новое", background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }
};

const statusMeta: Record<string, { label: string; background: string; color: string }> = {
  GREEN: { label: "решено", background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" },
  YELLOW: { label: "с ошибками", background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" },
  RED: { label: "не решено", background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }
};

function isParticipantPending(participant: LessonBoardParticipant) {
  return !participant.planGeneratedAt && !participant.planError;
}

function isParticipantStale(participant: LessonBoardParticipant) {
  return isParticipantPending(participant) && Date.now() - new Date(participant.createdAt).getTime() > STALE_PLAN_MS;
}

export function TeacherLessonBoard({ prefix, aiAvailable, lesson, bank }: TeacherLessonBoardProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState(lesson.participants);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const lastSignature = useRef("");

  useEffect(() => {
    setParticipants(lesson.participants);
  }, [lesson.participants]);

  const pendingCount = useMemo(
    () => participants.filter((participant) => isParticipantPending(participant) && !isParticipantStale(participant)).length,
    [participants]
  );
  const readyCount = participants.filter((participant) => participant.planGeneratedAt).length;

  // Поллинг статуса генерации, пока есть незавершённые ученики.
  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/status`, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const status = (await response.json()) as {
          pending: number;
          participants: Array<{ participantId: string; planGeneratedAt: string | null; planError: string | null; itemsCount: number }>;
        };

        const signature = status.participants
          .map((participant) => `${participant.participantId}:${participant.planGeneratedAt ?? ""}:${participant.planError ?? ""}`)
          .join("|");

        if (signature !== lastSignature.current) {
          lastSignature.current = signature;
          // Готовые планы приезжают с сервера полной перерисовкой.
          router.refresh();
        }
      } catch {
        // Сеть мигнула — следующий тик попробует снова.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [pendingCount, lesson.id, router]);

  const saveItems = useCallback(
    async (participantId: string, homeworkNumberIds: string[], extraHomeworkNumberIds: string[]) => {
      setBusyParticipantId(participantId);
      setNotice(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/participants/${participantId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeworkNumberIds, extraHomeworkNumberIds })
        });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить набор.");
        }

        startTransition(() => router.refresh());
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось сохранить набор." });
      } finally {
        setBusyParticipantId(null);
      }
    },
    [lesson.id, router]
  );

  const setResult = useCallback(
    async (participantId: string, itemId: string, result: string | null) => {
      // Оптимистично: светофор подсвечивается сразу, сервер догоняет через refresh.
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                items: participant.items.map((item) => (item.id === itemId ? { ...item, result } : item))
              }
            : participant
        )
      );

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lesson.id}/participants/${participantId}/items/${itemId}/result`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result })
          }
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error || "Не удалось сохранить итог.");
        }

        startTransition(() => router.refresh());
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось сохранить итог." });
        startTransition(() => router.refresh());
      }
    },
    [lesson.id, router]
  );

  const regenerate = useCallback(
    async (participantId: string) => {
      setBusyParticipantId(participantId);
      setNotice(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/participants/${participantId}/regenerate`, {
          method: "POST"
        });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось запустить пересборку.");
        }

        setParticipants((current) =>
          current.map((participant) =>
            participant.id === participantId
              ? { ...participant, planGeneratedAt: null, planError: null, createdAt: new Date().toISOString() }
              : participant
          )
        );
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось запустить пересборку." });
      } finally {
        setBusyParticipantId(null);
      }
    },
    [lesson.id]
  );

  const deleteLesson = useCallback(async () => {
    const response = await fetch(`/api/teacher/lessons/${lesson.id}`, { method: "DELETE" });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error || "Не удалось удалить урок.");
    }

    router.push(`${prefix}/lessons`);
  }, [lesson.id, prefix, router]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <a
          href={`${prefix}/lessons/${lesson.id}/pdf`}
          className="shbz-btn-primary inline-block px-[22px] py-[11px] text-[14px] no-underline"
        >
          Скачать PDF
        </a>
        <a
          href={`${prefix}/lessons/${lesson.id}/print`}
          target="_blank"
          rel="noreferrer"
          className="shbz-btn-outline inline-block no-underline"
        >
          Версия для печати
        </a>
        <a
          href={`${prefix}/homework-plans/new?lessonId=${lesson.id}`}
          className="shbz-btn-outline inline-block no-underline"
        >
          Выдать ДЗ по итогам занятия
        </a>
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
            Готово {readyCount} из {participants.length}…
          </span>
        ) : null}
        <span className="ml-auto">
          <DeleteButton
            variant="sm"
            label="Удалить урок"
            title="Удалить урок?"
            description="Занятие и все подобранные наборы задач будут удалены. Это действие нельзя отменить."
            onConfirm={deleteLesson}
            onError={(error) =>
              setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось удалить урок." })
            }
          />
        </span>
      </div>

      {!aiAvailable ? (
        <div
          className="mb-5 rounded-[12px] border px-5 py-4 text-sm font-medium"
          style={{ background: "var(--shbz-yellow-soft)", borderColor: "var(--shbz-yellow-text)", color: "var(--shbz-yellow-text)" }}
        >
          ИИ-подбор недоступен, соберите урок вручную: добавляйте номера в карточках учеников.
        </div>
      ) : null}

      {notice ? (
        <div
          className={`${notice.tone === "success" ? "shbz-notice-success" : "shbz-notice-error"} mb-5 px-5 py-4 text-sm font-medium`}
          aria-live="polite"
        >
          {notice.text}
        </div>
      ) : null}

      <div className="space-y-5">
        {participants.map((participant) => {
          const pending = isParticipantPending(participant) && !isParticipantStale(participant);
          const stale = isParticipantStale(participant);
          const busy = busyParticipantId === participant.id;
          const mainItems = participant.items.filter((item) => !item.isExtra);
          const extraItems = participant.items.filter((item) => item.isExtra);
          const mainIds = mainItems.map((item) => item.homeworkNumberId);
          const extraIds = extraItems.map((item) => item.homeworkNumberId);
          const totalMinutes = mainItems.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
          const removeItem = (target: LessonBoardItem) =>
            void saveItems(
              participant.id,
              mainIds.filter((id) => id !== target.homeworkNumberId),
              extraIds.filter((id) => id !== target.homeworkNumberId)
            );

          return (
            <article key={participant.id} className="shbz-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                    {participant.studentName}
                  </h3>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                    скорость: {participant.speed ?? "не указана"} · основных: {mainItems.length}
                    {extraItems.length > 0 ? ` · доп.: ${extraItems.length}` : ""}
                    {totalMinutes > 0 ? ` · ~${totalMinutes} мин по оценке ИИ (это оценка, не расчёт)` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || pending || !aiAvailable}
                  onClick={() => void regenerate(participant.id)}
                  className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Пересобрать для этого ученика
                </button>
              </div>

              {pending ? (
                <p className="mt-4 inline-flex items-center gap-2.5 text-sm font-medium" style={{ color: "var(--shbz-text-muted)" }}>
                  <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
                  ИИ подбирает задания…
                </p>
              ) : null}

              {stale ? (
                <div className="shbz-notice-error mt-4 px-4 py-3 text-sm">
                  Не сгенерировано: похоже, очередь была сброшена рестартом.{" "}
                  <button type="button" className="font-bold underline" onClick={() => void regenerate(participant.id)}>
                    Повторить
                  </button>
                </div>
              ) : null}

              {participant.planError ? (
                <div className="shbz-notice-error mt-4 px-4 py-3 text-sm">
                  {participant.planError}{" "}
                  {aiAvailable ? (
                    <button type="button" className="font-bold underline" onClick={() => void regenerate(participant.id)}>
                      Повторить
                    </button>
                  ) : null}
                </div>
              ) : null}

              {participant.planSummary ? (
                <p
                  className="mt-4 rounded-[12px] px-4 py-3 text-sm leading-6"
                  style={{ background: "var(--shbz-soft-bg)", color: "var(--shbz-text-muted)" }}
                >
                  {participant.planSummary}
                </p>
              ) : null}

              {mainItems.length > 0 ? (
                <ol className="mt-4 space-y-2">
                  {mainItems.map((item, index) => {
                    const reason = reasonMeta[item.reason] ?? reasonMeta.NEW;
                    const status = item.studentStatus ? statusMeta[item.studentStatus] : null;

                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border px-3.5 py-2.5"
                        style={{ borderColor: "var(--shbz-soft-border)", background: "var(--shbz-soft-bg)" }}
                      >
                        <span className="text-xs font-bold" style={{ color: "var(--shbz-kicker)" }}>
                          {index + 1}.
                        </span>
                        <span className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                          № {item.number}
                        </span>
                        <span className="text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                          {item.topicTitle}
                        </span>
                        {item.difficulty ? (
                          <span className="shbz-chip" style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", padding: "3px 9px" }}>
                            сложн. {item.difficulty}
                          </span>
                        ) : null}
                        <span className="shbz-chip" style={{ background: reason.background, color: reason.color, padding: "3px 9px" }}>
                          {reason.label}
                        </span>
                        {status && !item.result ? (
                          <span className="shbz-chip" style={{ background: status.background, color: status.color, padding: "3px 9px" }}>
                            {status.label}
                          </span>
                        ) : null}
                        {item.comment ? (
                          <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                            {item.comment}
                          </span>
                        ) : null}
                        <ResultToggle
                          className="ml-auto"
                          value={item.result}
                          disabled={busy}
                          onChange={(next) => void setResult(participant.id, item.id, next)}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Убрать № ${item.number}`}
                          onClick={() => removeItem(item)}
                          className="text-[16px] leading-none opacity-60 transition hover:opacity-100"
                          style={{ color: "var(--shbz-danger-text)" }}
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : !pending ? (
                <p className="mt-4 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                  Задач пока нет — добавьте вручную или запустите подбор.
                </p>
              ) : null}

              {extraItems.length > 0 ? (
                <div className="mt-4">
                  <p
                    className="mb-2 text-[11px] font-bold uppercase tracking-[1.2px]"
                    style={{ color: "var(--shbz-kicker)" }}
                  >
                    Дополнительно ⭐ — если основная часть решена
                  </p>
                  <ol className="space-y-2">
                    {extraItems.map((item) => {
                      const reason = reasonMeta[item.reason] ?? reasonMeta.NEW;

                      return (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border border-dashed px-3.5 py-2.5"
                          style={{ borderColor: "var(--shbz-soft-border)" }}
                        >
                          <span className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                            № {item.number}
                          </span>
                          <span className="text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                            {item.topicTitle}
                          </span>
                          {item.difficulty ? (
                            <span
                              className="shbz-chip"
                              style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", padding: "3px 9px" }}
                            >
                              сложн. {item.difficulty}
                            </span>
                          ) : null}
                          <span className="shbz-chip" style={{ background: reason.background, color: reason.color, padding: "3px 9px" }}>
                            {reason.label}
                          </span>
                          {item.comment ? (
                            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                              {item.comment}
                            </span>
                          ) : null}
                          <ResultToggle
                            className="ml-auto"
                            value={item.result}
                            disabled={busy}
                            onChange={(next) => void setResult(participant.id, item.id, next)}
                          />
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Убрать № ${item.number}`}
                            onClick={() => removeItem(item)}
                            className="text-[16px] leading-none opacity-60 transition hover:opacity-100"
                            style={{ color: "var(--shbz-danger-text)" }}
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              <LessonManualAdd
                bank={bank}
                busy={busy}
                existingIds={participant.items.map((item) => item.homeworkNumberId)}
                onAdd={(homeworkNumberId, toExtra) =>
                  void saveItems(
                    participant.id,
                    toExtra ? mainIds : [...mainIds, homeworkNumberId],
                    toExtra ? [...extraIds, homeworkNumberId] : extraIds
                  )
                }
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

