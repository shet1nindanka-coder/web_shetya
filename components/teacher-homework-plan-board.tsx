"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShbzSelect } from "@/components/shbz-select";

const STALE_PLAN_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 2000;

type PlanItem = {
  id: string;
  homeworkNumberId: string;
  number: number;
  difficulty: number | null;
  reason: string;
  minutes: number | null;
  comment: string | null;
  studentStatus: string | null;
};

type PlanParticipant = {
  id: string;
  studentId: string;
  studentName: string;
  planSummary: string | null;
  planGeneratedAt: string | null;
  planError: string | null;
  issuedAssignmentId: string | null;
  issuedAt: string | null;
  createdAt: string;
  items: PlanItem[];
};

type TeacherHomeworkPlanBoardProps = {
  prefix: string;
  aiAvailable: boolean;
  plan: {
    id: string;
    topicTitle: string;
    participants: PlanParticipant[];
  };
  topicNumbers: Array<{ id: string; number: number; difficulty: number | null }>;
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

function isPending(participant: PlanParticipant) {
  return !participant.planGeneratedAt && !participant.planError && !participant.issuedAssignmentId;
}

function isStale(participant: PlanParticipant) {
  return isPending(participant) && Date.now() - new Date(participant.createdAt).getTime() > STALE_PLAN_MS;
}

export function TeacherHomeworkPlanBoard({ prefix, aiAvailable, plan, topicNumbers }: TeacherHomeworkPlanBoardProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState(plan.participants);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [issueFailures, setIssueFailures] = useState<Array<{ name: string; message: string }>>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();
  const lastSignature = useRef("");

  useEffect(() => {
    setParticipants(plan.participants);
  }, [plan.participants]);

  const pendingCount = useMemo(
    () => participants.filter((participant) => isPending(participant) && !isStale(participant)).length,
    [participants]
  );
  const readyCount = participants.filter((participant) => participant.planGeneratedAt).length;
  const issuedCount = participants.filter((participant) => participant.issuedAssignmentId).length;
  const issuableCount = participants.filter(
    (participant) => !participant.issuedAssignmentId && participant.items.length > 0
  ).length;

  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/teacher/homework-plans/${plan.id}/status`, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const status = (await response.json()) as {
          participants: Array<{ participantId: string; planGeneratedAt: string | null; planError: string | null; issuedAssignmentId: string | null }>;
        };
        const signature = status.participants
          .map((entry) => `${entry.participantId}:${entry.planGeneratedAt ?? ""}:${entry.planError ?? ""}:${entry.issuedAssignmentId ?? ""}`)
          .join("|");

        if (signature !== lastSignature.current) {
          lastSignature.current = signature;
          router.refresh();
        }
      } catch {
        // Сеть мигнула — следующий тик попробует снова.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [pendingCount, plan.id, router]);

  const saveItems = useCallback(
    async (participantId: string, homeworkNumberIds: string[]) => {
      setBusyId(participantId);
      setNotice(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${plan.id}/participants/${participantId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ homeworkNumberIds, extraHomeworkNumberIds: [] })
        });
        const result = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить набор.");
        }

        startTransition(() => router.refresh());
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось сохранить набор." });
      } finally {
        setBusyId(null);
      }
    },
    [plan.id, router]
  );

  const regenerate = useCallback(
    async (participantId: string) => {
      setBusyId(participantId);
      setNotice(null);

      try {
        const response = await fetch(`/api/teacher/lessons/${plan.id}/participants/${participantId}/regenerate`, {
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
        setBusyId(null);
      }
    },
    [plan.id]
  );

  const issue = useCallback(
    async (participantIds: string[] | null) => {
      setBusyId(participantIds?.length === 1 ? participantIds[0] : "all");
      setNotice(null);
      setIssueFailures([]);

      try {
        const response = await fetch(`/api/teacher/homework-plans/${plan.id}/issue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantIds: participantIds ?? [] })
        });
        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; issued?: Array<{ name: string }>; failed?: Array<{ name: string; message: string }>; error?: string }
          | null;

        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || "Не удалось выдать ДЗ.");
        }

        const issuedNow = result.issued?.length ?? 0;
        const failedNow = result.failed ?? [];

        if (issuedNow > 0) {
          setNotice({ tone: "success", text: `ДЗ выдано: ${issuedNow} ${issuedNow === 1 ? "ученику" : "ученикам"}.` });
        } else if (failedNow.length === 0) {
          setNotice({ tone: "success", text: "Все выбранные ученики уже получили это ДЗ." });
        }

        setIssueFailures(failedNow.map((entry) => ({ name: entry.name, message: entry.message })));
        startTransition(() => router.refresh());
      } catch (error) {
        setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось выдать ДЗ." });
      } finally {
        setBusyId(null);
      }
    },
    [plan.id, router]
  );

  const deletePlan = useCallback(async () => {
    try {
      const response = await fetch(`/api/teacher/homework-plans/${plan.id}`, { method: "DELETE" });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || "Не удалось удалить черновик.");
      }

      router.push(`${prefix}/homework-plans`);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Не удалось удалить черновик." });
    }
  }, [plan.id, prefix, router]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={busyId !== null || issuableCount === 0}
          onClick={() => void issue(null)}
          className="shbz-btn-primary px-[22px] py-[11px] text-[14px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-2">
            {busyId === "all" ? <span className="shbz-spinner" aria-hidden /> : null}
            Выдать всем ({issuableCount})
          </span>
        </button>
        {issuedCount > 0 ? (
          <span className="shbz-chip shbz-chip-green">выдано {issuedCount} из {participants.length}</span>
        ) : null}
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
                onClick={() => void deletePlan()}
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
              Удалить черновик
            </button>
          )}
        </span>
      </div>

      {!aiAvailable ? (
        <div
          className="mb-5 rounded-[12px] border px-5 py-4 text-sm font-medium"
          style={{ background: "var(--shbz-yellow-soft)", borderColor: "var(--shbz-yellow-text)", color: "var(--shbz-yellow-text)" }}
        >
          ИИ-подбор недоступен, соберите ДЗ вручную: добавляйте номера в карточках учеников.
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

      {issueFailures.length > 0 ? (
        <div className="shbz-notice-error mb-5 px-5 py-4 text-sm" aria-live="polite">
          <p className="font-bold">Не удалось выдать:</p>
          <ul className="mt-1.5 space-y-1">
            {issueFailures.map((failure, index) => (
              <li key={index}>
                <b>{failure.name}</b>: {failure.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-5">
        {participants.map((participant) => {
          const pending = isPending(participant) && !isStale(participant);
          const stale = isStale(participant);
          const busy = busyId === participant.id || busyId === "all";
          const issued = Boolean(participant.issuedAssignmentId);

          return (
            <article key={participant.id} className="shbz-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                    {participant.studentName}
                  </h3>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                    задач: {participant.items.length}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  {issued ? (
                    <>
                      <span className="shbz-chip shbz-chip-green">Выдано</span>
                      <a href={`${prefix}/students/${participant.studentId}`} className="shbz-btn-outline no-underline">
                        ДЗ ученика
                      </a>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy || pending || !aiAvailable}
                        onClick={() => void regenerate(participant.id)}
                        className="shbz-btn-outline disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Пересобрать
                      </button>
                      <button
                        type="button"
                        disabled={busy || pending || participant.items.length === 0}
                        onClick={() => void issue([participant.id])}
                        className="shbz-btn-primary px-[18px] py-[10px] text-[13.5px] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-2">
                          {busyId === participant.id ? <span className="shbz-spinner" aria-hidden /> : null}
                          Выдать
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {pending ? (
                <p className="mt-4 inline-flex items-center gap-2.5 text-sm font-medium" style={{ color: "var(--shbz-text-muted)" }}>
                  <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
                  ИИ подбирает задание…
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

              {participant.planError && !issued ? (
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
                        {!issued ? (
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Убрать № ${item.number}`}
                            onClick={() =>
                              void saveItems(
                                participant.id,
                                participant.items
                                  .filter((entry) => entry.id !== item.id)
                                  .map((entry) => entry.homeworkNumberId)
                              )
                            }
                            className="ml-auto text-[16px] leading-none opacity-60 transition hover:opacity-100"
                            style={{ color: "var(--shbz-danger-text)" }}
                          >
                            ×
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : !pending ? (
                <p className="mt-4 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
                  Задач пока нет — добавьте вручную или запустите подбор.
                </p>
              ) : null}

              {!issued ? (
                <ManualAdd
                  topicTitle={plan.topicTitle}
                  numbers={topicNumbers}
                  busy={busy}
                  existingIds={participant.items.map((item) => item.homeworkNumberId)}
                  onAdd={(homeworkNumberId) =>
                    void saveItems(participant.id, [
                      ...participant.items.map((item) => item.homeworkNumberId),
                      homeworkNumberId
                    ])
                  }
                />
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ManualAdd({
  topicTitle,
  numbers,
  busy,
  existingIds,
  onAdd
}: {
  topicTitle: string;
  numbers: Array<{ id: string; number: number; difficulty: number | null }>;
  busy: boolean;
  existingIds: string[];
  onAdd: (homeworkNumberId: string) => void;
}) {
  const [numberId, setNumberId] = useState("");
  const existing = new Set(existingIds);
  const options = numbers
    .filter((number) => !existing.has(number.id))
    .map((number) => ({
      value: number.id,
      label: number.difficulty ? `№ ${number.number} · сложн. ${number.difficulty}` : `№ ${number.number}`
    }));

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        Добавить номер · {topicTitle}
      </span>
      <div style={{ width: 200 }}>
        <ShbzSelect
          size="xs"
          ariaLabel="Номер"
          value={numberId}
          placeholder="Выберите номер"
          options={options}
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
