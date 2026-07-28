"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ShbzSelect } from "@/components/shbz-select";

const STALE_PLAN_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 2000;

type LessonBoardItem = {
  id: string;
  homeworkNumberId: string;
  number: number;
  difficulty: number | null;
  reason: string;
  minutes: number | null;
  comment: string | null;
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
    numbers: Array<{ id: string; number: number; difficulty: number | null }>;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    async (participantId: string, homeworkNumberIds: string[]) => {
      setBusyParticipantId(participantId);
      setNotice(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/participants/${participantId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeworkNumberIds })
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
    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}`, { method: "DELETE" });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Не удалось удалить урок.");
      }

      router.push(`${prefix}/lessons`);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось удалить урок." });
    }
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
        {pendingCount > 0 ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
            <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
            Готово {readyCount} из {participants.length}…
          </span>
        ) : null}
        <span className="ml-auto">
          {confirmDelete ? (
            <span className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => void deleteLesson()}
                className="ui-pressable ui-button-danger rounded-[12px] px-3.5 py-2 text-sm font-semibold transition"
              >
                Точно удалить
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="shbz-btn-outline">
                Отмена
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-sm font-semibold"
              style={{ color: "var(--shbz-danger-text)" }}
            >
              Удалить урок
            </button>
          )}
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
          const totalMinutes = participant.items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);

          return (
            <article key={participant.id} className="shbz-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                    {participant.studentName}
                  </h3>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                    скорость: {participant.speed ?? "не указана"} · задач: {participant.items.length}
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

              {participant.items.length > 0 ? (
                <ol className="mt-4 space-y-2">
                  {participant.items.map((item, index) => {
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
                        {status ? (
                          <span className="shbz-chip" style={{ background: status.background, color: status.color, padding: "3px 9px" }}>
                            {status.label}
                          </span>
                        ) : null}
                        {item.comment ? (
                          <span className="min-w-0 flex-1 truncate text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                            {item.comment}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Убрать № ${item.number}`}
                          onClick={() =>
                            void saveItems(
                              participant.id,
                              participant.items.filter((entry) => entry.id !== item.id).map((entry) => entry.homeworkNumberId)
                            )
                          }
                          className="ml-auto text-[16px] leading-none opacity-60 transition hover:opacity-100"
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

              <ManualAdd
                bank={bank}
                busy={busy}
                existingIds={participant.items.map((item) => item.homeworkNumberId)}
                onAdd={(homeworkNumberId) =>
                  void saveItems(participant.id, [...participant.items.map((item) => item.homeworkNumberId), homeworkNumberId])
                }
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ManualAdd({
  bank,
  busy,
  existingIds,
  onAdd
}: {
  bank: TeacherLessonBoardProps["bank"];
  busy: boolean;
  existingIds: string[];
  onAdd: (homeworkNumberId: string) => void;
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
            onAdd(numberId);
            setNumberId("");
          }
        }}
        className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
      >
        Добавить
      </button>
    </div>
  );
}
