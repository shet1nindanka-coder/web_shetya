"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { DeleteButton } from "@/components/delete-button";
import { LessonManualAdd } from "@/components/lesson-manual-add";
import { ProgressStatusHistory } from "@/components/progress-status-history";
import { ResultToggle } from "@/components/lesson-result-toggle";
import { computeIdleLevel, computeSpentMinutes, type IdleLevel } from "@/lib/lesson-live";

const STALE_PLAN_MS = 15 * 60_000;
const POLL_INTERVAL_MS = 2000;
// Поллинг живой активности — фолбэк, основной канал обновления — SSE.
const LIVE_POLL_INTERVAL_MS = 15_000;
const UNDO_REMOVE_MS = 5000;

// Горячие клавиши отметки итога на строке набора.
const RESULT_HOTKEYS: Record<string, string> = {
  "1": "SOLVED",
  "2": "PARTIAL",
  "3": "NOT_SOLVED",
  "4": "SKIPPED",
};

type LessonBoardSubmission = {
  status: "PENDING" | "CHECKING" | "DONE" | "FAILED";
  verdict: string | null;
  submittedAt: string;
  checkedAt: string | null;
  photoFileIds: string[];
};

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
  submission: LessonBoardSubmission | null;
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
  joinedAt: string | null;
  items: LessonBoardItem[];
};

type TeacherLessonBoardProps = {
  prefix: string;
  aiAvailable: boolean;
  lesson: {
    id: string;
    status: "PLANNED" | "ACTIVE" | "FINISHED";
    startsAt: string | null;
    participants: LessonBoardParticipant[];
  };
  idleWarnMinutes: number;
  idleAlertMinutes: number;
  bank: Array<{
    topicId: string;
    topicTitle: string;
    numbers: Array<{ id: string; number: string; difficulty: number | null }>;
  }>;
};

const lessonStatusLabels: Record<string, string> = {
  PLANNED: "Запланирован",
  ACTIVE: "Идёт",
  FINISHED: "Завершён"
};

function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatMinutesAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

  if (minutes === 0) {
    return "только что";
  }

  return `${minutes} мин назад`;
}

// Причина подбора — не статус: нейтральная палитра, чтобы в одной строке
// не стояли два одинаковых по форме чипа из статусной палитры («Правило светофора», DESIGN.md).
const reasonMeta: Record<
  string,
  { label: string; background: string; color: string }
> = {
  GAP: {
    label: "Пробел",
    background: "var(--shbz-tab-hover)",
    color: "var(--shbz-kicker)",
  },
  REVIEW: {
    label: "Повторение",
    background: "var(--shbz-tab-hover)",
    color: "var(--shbz-kicker)",
  },
  NEW: {
    label: "Новое",
    background: "var(--shbz-tab-hover)",
    color: "var(--shbz-kicker)",
  },
};

const statusMeta: Record<
  string,
  { label: string; background: string; color: string }
> = {
  GREEN: {
    label: "решено",
    background: "var(--shbz-green-soft)",
    color: "var(--shbz-green-text)",
  },
  YELLOW: {
    label: "с ошибками",
    background: "var(--shbz-yellow-soft)",
    color: "var(--shbz-yellow-text)",
  },
  RED: {
    label: "не решено",
    background: "var(--shbz-danger-bg)",
    color: "var(--shbz-danger-text)",
  },
};

function isParticipantPending(participant: LessonBoardParticipant) {
  return !participant.planGeneratedAt && !participant.planError;
}

// «Сейчас» приходит параметром из тикающего состояния: без него зависший
// участник никогда не перерисуется и stale не наступит.
function isParticipantStale(participant: LessonBoardParticipant, now: number) {
  return (
    isParticipantPending(participant) &&
    now - new Date(participant.createdAt).getTime() > STALE_PLAN_MS
  );
}

export function TeacherLessonBoard({
  prefix,
  aiAvailable,
  lesson,
  idleWarnMinutes,
  idleAlertMinutes,
  bank,
}: TeacherLessonBoardProps) {
  const router = useRouter();
  const [participants, setParticipants] = useState(lesson.participants);
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  // Ошибка сохранения итога — в строке номера, а не наверху доски.
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  // Тост «№ N убран» с 5-секундной отменой удаления из набора.
  const [undoState, setUndoState] = useState<{
    participantId: string;
    mainIds: string[];
    extraIds: string[];
    label: string;
  } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();
  const [historyVersion, setHistoryVersion] = useState(0);
  const lastSignature = useRef("");
  const lastLiveSignature = useRef("");
  const [finishing, setFinishing] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const isLive = lesson.status === "ACTIVE";

  useEffect(() => {
    return () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    setParticipants(lesson.participants);
  }, [lesson.participants]);

  // Тик раз в 30 секунд, чтобы зависшая генерация со временем стала stale на экране.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);

    return () => clearInterval(timer);
  }, []);

  const pendingCount = useMemo(
    () =>
      participants.filter(
        (participant) =>
          isParticipantPending(participant) &&
          !isParticipantStale(participant, now),
      ).length,
    [participants, now],
  );
  const readyCount = participants.filter(
    (participant) => participant.planGeneratedAt,
  ).length;

  // Поллинг статуса генерации, пока есть незавершённые ученики.
  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/teacher/lessons/${lesson.id}/status`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const status = (await response.json()) as {
          pending: number;
          participants: Array<{
            participantId: string;
            planGeneratedAt: string | null;
            planError: string | null;
            itemsCount: number;
          }>;
        };

        const signature = status.participants
          .map(
            (participant) =>
              `${participant.participantId}:${participant.planGeneratedAt ?? ""}:${participant.planError ?? ""}`,
          )
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

  // Живая панель: пока урок идёт, раз в 15 секунд сверяем сигнатуру активности —
  // фолбэк на случай, если SSE-событие потерялось.
  useEffect(() => {
    if (!isLive) {
      return;
    }

    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/teacher/lessons/${lesson.id}/live`, { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { signature?: string };
        const signature = payload.signature ?? "";

        if (lastLiveSignature.current && signature !== lastLiveSignature.current) {
          startTransition(() => router.refresh());
        }

        lastLiveSignature.current = signature;
      } catch {
        // Сеть мигнула — следующий тик попробует снова.
      }
    }, LIVE_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isLive, lesson.id, router, startTransition]);

  const finishLesson = useCallback(async () => {
    setFinishing(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}/finish`, { method: "POST" });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось завершить урок.");
      }

      startTransition(() => router.refresh());
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Не удалось завершить урок.",
      });
    } finally {
      setFinishing(false);
    }
  }, [lesson.id, router, startTransition]);

  const scheduleLesson = useCallback(async () => {
    if (!scheduleValue) {
      return;
    }

    setScheduling(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(scheduleValue).toISOString() }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось назначить время урока.");
      }

      startTransition(() => router.refresh());
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Не удалось назначить время урока.",
      });
    } finally {
      setScheduling(false);
    }
  }, [lesson.id, router, scheduleValue, startTransition]);

  const saveItems = useCallback(
    async (
      participantId: string,
      homeworkNumberIds: string[],
      extraHomeworkNumberIds: string[],
    ) => {
      setBusyParticipantId(participantId);
      setNotice(null);

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lesson.id}/participants/${participantId}/items`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ homeworkNumberIds, extraHomeworkNumberIds }),
          },
        );
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сохранить набор.");
        }

        startTransition(() => router.refresh());
      } catch (error) {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Не удалось сохранить набор.",
        });
      } finally {
        setBusyParticipantId(null);
      }
    },
    [lesson.id, router],
  );

  const setResult = useCallback(
    async (participantId: string, itemId: string, result: string | null) => {
      // Оптимистично: светофор подсвечивается сразу, сервер догоняет через refresh.
      setParticipants((current) =>
        current.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                items: participant.items.map((item) =>
                  item.id === itemId ? { ...item, result } : item,
                ),
              }
            : participant,
        ),
      );
      setItemErrors((current) => {
        if (!(itemId in current)) {
          return current;
        }

        const next = { ...current };
        delete next[itemId];

        return next;
      });

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lesson.id}/participants/${participantId}/items/${itemId}/result`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ result }),
          },
        );

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || "Не удалось сохранить итог.");
        }

        setHistoryVersion((version) => version + 1);
        startTransition(() => router.refresh());
      } catch (error) {
        setItemErrors((current) => ({
          ...current,
          [itemId]:
            error instanceof Error
              ? error.message
              : "Не удалось сохранить итог.",
        }));
        startTransition(() => router.refresh());
      }
    },
    [lesson.id, router],
  );

  // 1/2/3 — отметить итог, ↑/↓ — перейти между строками набора.
  const handleItemKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLLIElement>,
      participantId: string,
      item: LessonBoardItem,
    ) => {
      if (event.target !== event.currentTarget) {
        return;
      }

      const hotkeyResult = RESULT_HOTKEYS[event.key];

      if (hotkeyResult) {
        event.preventDefault();
        void setResult(
          participantId,
          item.id,
          item.result === hotkeyResult ? null : hotkeyResult,
        );
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const rows = Array.from(
          document.querySelectorAll<HTMLLIElement>("[data-lesson-item]"),
        );
        const index = rows.indexOf(event.currentTarget);
        rows[index + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
      }
    },
    [setResult],
  );

  const regenerate = useCallback(
    async (participantId: string) => {
      setBusyParticipantId(participantId);
      setNotice(null);

      try {
        const response = await fetch(
          `/api/teacher/lessons/${lesson.id}/participants/${participantId}/regenerate`,
          {
            method: "POST",
          },
        );
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось запустить пересборку.");
        }

        setParticipants((current) =>
          current.map((participant) =>
            participant.id === participantId
              ? {
                  ...participant,
                  planGeneratedAt: null,
                  planError: null,
                  createdAt: new Date().toISOString(),
                }
              : participant,
          ),
        );
      } catch (error) {
        setNotice({
          tone: "error",
          text:
            error instanceof Error
              ? error.message
              : "Не удалось запустить пересборку.",
        });
      } finally {
        setBusyParticipantId(null);
      }
    },
    [lesson.id],
  );

  const deleteLesson = useCallback(async () => {
    const response = await fetch(`/api/teacher/lessons/${lesson.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(result?.error || "Не удалось удалить урок.");
    }

    router.push(`${prefix}/lessons`);
  }, [lesson.id, prefix, router]);

  // Сдача по номеру: когда сдал (абсолютное время — в подсказке), сколько минут
  // ушло, ссылки на фото. Пока идёт проверка — спиннер (индикация загрузки).
  const renderSubmissionInfo = (item: LessonBoardItem, spentMinutes?: number) => {
    const submission = item.submission;

    if (!submission) {
      return null;
    }

    const checking = submission.status === "PENDING" || submission.status === "CHECKING";

    return (
      <span className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 text-xs" style={{ color: "var(--shbz-text-soft)" }}>
        {checking ? (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{ color: "var(--shbz-text-muted)" }}
          >
            <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
            проверяется
          </span>
        ) : (
          <span title={new Date(submission.submittedAt).toLocaleString("ru-RU")}>
            сдал {formatMinutesAgo(submission.submittedAt, now)}
            {typeof spentMinutes === "number" ? ` · ${spentMinutes} мин на номер` : ""}
          </span>
        )}
        {submission.status === "FAILED" ? (
          <span style={{ color: "var(--shbz-danger-text)" }}>проверка не удалась</span>
        ) : null}
        {submission.status === "DONE" && submission.verdict === "UNCERTAIN" ? (
          // Верно/неверно ставят итог автоматически — отдельная пометка не нужна.
          // Только «не распознано» остаётся за учителем, и об этом надо сказать.
          <span
            className="shbz-chip"
            style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", padding: "2px 8px" }}
          >
            не распознано — отметьте вручную
          </span>
        ) : null}
        {submission.photoFileIds.map((fileId, index) => (
          <a
            key={fileId}
            href={`/files/${fileId}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
            style={{ color: "var(--shbz-kicker)" }}
          >
            фото {index + 1}
          </a>
        ))}
      </span>
    );
  };

  return (
    <div>
      {/* Два слоя: левая группа переносится внутри себя, «Удалить урок» закреплена
          справа — появление счётчика «Готово X из Y…» не сдвигает её на новую строку. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
        {/* Действия «до и после урока» — обычные кнопки в одну строку,
            в едином стиле платформы (меню-дропдаун выбивалось — решение владельца). */}
        {/* Ростом с соседние кнопки действий, чтобы строка читалась одной линией. */}
        <span
          className="inline-flex items-center rounded-[12px] px-[18px] text-[14px] font-bold"
          style={{
            height: "var(--shbz-btn-h)",
            ...(isLive
              ? { background: "var(--shbz-accent-solid)", color: "#fff" }
              : { background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }),
          }}
        >
          {lessonStatusLabels[lesson.status] ?? lesson.status}
        </span>
        {isLive ? (
          <button
            type="button"
            disabled={finishing}
            onClick={() => void finishLesson()}
            className="shbz-btn-outline"
          >
            {finishing ? "Завершаем…" : "Завершить урок"}
          </button>
        ) : null}
        <a
          href={`${prefix}/lessons/${lesson.id}/pdf`}
          className="shbz-btn-outline inline-block no-underline"
        >
          Скачать PDF
        </a>
        <a
          href={`${prefix}/lessons/${lesson.id}/print`}
          target="_blank"
          rel="noreferrer"
          className="shbz-btn-outline inline-block no-underline"
        >
          Для печати
        </a>
        <a
          href={`${prefix}/lessons/${lesson.id}/pdf?answers=1`}
          className="shbz-btn-outline inline-block no-underline"
        >
          Ответы (PDF)
        </a>
        <a
          href={`${prefix}/homework-plans/new?lessonId=${lesson.id}`}
          className="shbz-btn-outline inline-block no-underline"
        >
          Выдать ДЗ по итогам
        </a>
        <span
          className="ui-hint text-xs"
          style={{ color: "var(--shbz-kicker)" }}
        >
          Отметки: клавиши 1/2/3, переход — ↓
        </span>
        {pendingCount > 0 ? (
          <span
            role="status"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "var(--shbz-text-muted)" }}
          >
            <span
              className="shbz-spinner"
              style={{ color: "var(--shbz-accent-solid)" }}
              aria-hidden
            />
            Готово {readyCount} из {participants.length}…
          </span>
        ) : null}
        </div>
        <span className="shrink-0">
          <DeleteButton
            label="Удалить урок"
            title="Удалить урок?"
            description="Занятие и все подобранные наборы задач будут удалены. Это действие нельзя отменить."
            onConfirm={deleteLesson}
            onError={(error) =>
              setNotice({
                tone: "error",
                text:
                  error instanceof Error
                    ? error.message
                    : "Не удалось удалить урок.",
              })
            }
          />
        </span>
      </div>

      {!lesson.startsAt && lesson.status !== "FINISHED" ? (
        <div
          className="mb-5 flex flex-wrap items-center gap-3 rounded-[12px] border px-5 py-4"
          style={{ borderColor: "var(--shbz-soft-border)", background: "var(--shbz-soft-bg)" }}
        >
          <span className="text-sm font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
            У урока нет времени — он не начнётся и не появится у учеников во вкладке «Урок».
          </span>
          <input
            type="datetime-local"
            value={scheduleValue}
            onChange={(event) => setScheduleValue(event.target.value)}
            aria-label="Дата и время урока"
            className="shbz-input w-auto"
          />
          <button
            type="button"
            disabled={scheduling || !scheduleValue}
            onClick={() => void scheduleLesson()}
            className="shbz-btn-outline"
          >
            {scheduling ? "Сохраняем…" : "Назначить время"}
          </button>
        </div>
      ) : null}

      {!aiAvailable ? (
        <div
          className="mb-5 rounded-[12px] border px-5 py-4 text-sm font-medium"
          style={{
            background: "var(--shbz-yellow-soft)",
            borderColor: "var(--shbz-yellow-text)",
            color: "var(--shbz-yellow-text)",
          }}
        >
          ИИ-подбор недоступен, соберите урок вручную: добавляйте номера в
          карточках учеников.
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
          const pending =
            isParticipantPending(participant) &&
            !isParticipantStale(participant, now);
          const stale = isParticipantStale(participant, now);
          const busy = busyParticipantId === participant.id;
          const mainItems = participant.items.filter((item) => !item.isExtra);
          const extraItems = participant.items.filter((item) => item.isExtra);
          // Живой урок: сколько номеров сдано и когда ученик был активен в последний раз.
          const submittedItems = participant.items.filter((item) => item.submission);
          const lastActivityAt = [
            participant.joinedAt ? new Date(participant.joinedAt).getTime() : null,
            ...submittedItems.map((item) => new Date(item.submission!.submittedAt).getTime()),
          ]
            .filter((value): value is number => value !== null)
            .reduce<number | null>((max, value) => (max === null || value > max ? value : max), null);
          const idle: { level: IdleLevel; idleMinutes: number } | null =
            isLive && lesson.startsAt
              ? computeIdleLevel(
                  {
                    lastActivityAt,
                    lessonStartedAt: new Date(lesson.startsAt).getTime(),
                    warnMinutes: idleWarnMinutes,
                    alertMinutes: idleAlertMinutes,
                  },
                  now,
                )
              : null;
          // Минуты на номер: от предыдущего события участника до момента сдачи.
          const orderedSubmissionTimes = submittedItems
            .map((entry) => ({ itemId: entry.id, at: new Date(entry.submission!.submittedAt).getTime() }))
            .sort((left, right) => left.at - right.at);
          const spentMinutes = lesson.startsAt
            ? computeSpentMinutes(
                orderedSubmissionTimes.map((entry) => entry.at),
                {
                  lessonStartedAt: new Date(lesson.startsAt).getTime(),
                  joinedAt: participant.joinedAt ? new Date(participant.joinedAt).getTime() : null,
                },
              )
            : [];
          const spentByItemId = new Map(
            orderedSubmissionTimes.map((entry, index) => [entry.itemId, spentMinutes[index]]),
          );
          const mainIds = mainItems.map((item) => item.homeworkNumberId);
          const extraIds = extraItems.map((item) => item.homeworkNumberId);
          const removeItem = (target: LessonBoardItem) => {
            // Сохраняем состав до удаления — тост даёт 5 секунд на отмену.
            if (undoTimer.current) {
              clearTimeout(undoTimer.current);
            }

            setUndoState({
              participantId: participant.id,
              mainIds: [...mainIds],
              extraIds: [...extraIds],
              label: `№ ${target.number} убран из набора`,
            });
            undoTimer.current = setTimeout(
              () => setUndoState(null),
              UNDO_REMOVE_MS,
            );

            void saveItems(
              participant.id,
              mainIds.filter((id) => id !== target.homeworkNumberId),
              extraIds.filter((id) => id !== target.homeworkNumberId),
            );
          };

          return (
            <article
              key={participant.id}
              className="shbz-card p-6"
              // Тревога простоя — не светофор статусов: danger-рамка карточки,
              // чтобы учитель увидел, к кому подойти («Правило светофора», DESIGN.md).
              style={idle?.level === "alert" ? { borderColor: "var(--shbz-danger-border)" } : undefined}
            >
              <div
                className="sticky top-2 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-2 py-1.5"
                style={{ background: "var(--shbz-card-bg)" }}
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* H2 после H1 страницы: пропуск уровня H1→H3 ломал структуру для скринридера. */}
                  {/* Только имя: счётчик отметок и строка «скорость · основных · доп. ·
                      минуты по оценке ИИ» убраны — перегружали шапку (решение владельца). */}
                  <h2
                    className="text-[16px] font-bold"
                    style={{ color: "var(--shbz-text-strong)" }}
                  >
                    {participant.studentName}
                  </h2>
                  {isLive ? (
                    <>
                      <span
                        className="shbz-chip"
                        style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", padding: "3px 9px" }}
                      >
                        сдано {submittedItems.length} / {participant.items.length}
                      </span>
                      {participant.joinedAt ? (
                        <span className="text-xs" style={{ color: "var(--shbz-text-soft)" }}>
                          в классе с {formatClockTime(participant.joinedAt)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--shbz-text-soft)" }}>
                          ещё не открыл урок
                        </span>
                      )}
                      {idle && idle.level !== "ok" ? (
                        // Компактный чип в масштабе «сдано X/Y»; amber/danger —
                        // не светофор статусов номеров («Правило светофора», DESIGN.md).
                        <span
                          className="shbz-chip border"
                          style={
                            idle.level === "warn"
                              ? {
                                  background: "var(--theme-warning-soft)",
                                  borderColor: "var(--theme-warning-border)",
                                  color: "var(--theme-warning-text)",
                                  padding: "3px 9px",
                                }
                              : {
                                  background: "var(--shbz-danger-bg)",
                                  borderColor: "var(--shbz-danger-border)",
                                  color: "var(--shbz-danger-text)",
                                  padding: "3px 9px",
                                }
                          }
                        >
                          нет сдач {idle.idleMinutes} мин
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {/* Кнопки «Пересобрать» нет: промпт и вводные те же, результат
                    почти всегда тот же (решение владельца). Повтор остаётся
                    только как «Попробовать снова» при ошибке генерации. */}
              </div>

              {pending ? (
                <p
                  className="mt-4 inline-flex items-center gap-2.5 text-sm font-medium"
                  style={{ color: "var(--shbz-text-muted)" }}
                >
                  <span
                    className="shbz-spinner"
                    style={{ color: "var(--shbz-accent-solid)" }}
                    aria-hidden
                  />
                  ИИ подбирает задания…
                </p>
              ) : null}

              {stale ? (
                <div className="shbz-notice-error mt-4 px-4 py-3 text-sm">
                  План не собрался: задача потерялась при перезапуске сервера.
                  Нажмите «Повторить» — соберём заново.{" "}
                  <button
                    type="button"
                    className="font-bold underline"
                    onClick={() => void regenerate(participant.id)}
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              {participant.planError ? (
                <div className="shbz-notice-error mt-4 px-4 py-3 text-sm">
                  {participant.planError}{" "}
                  {aiAvailable ? (
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={() => void regenerate(participant.id)}
                    >
                      Повторить
                    </button>
                  ) : null}
                </div>
              ) : null}

              {participant.planSummary ? (
                <p
                  className="mt-4 rounded-[12px] px-4 py-3 text-sm leading-6"
                  style={{
                    background: "var(--shbz-soft-bg)",
                    color: "var(--shbz-text-muted)",
                  }}
                >
                  {participant.planSummary}
                </p>
              ) : null}

              {mainItems.length > 0 ? (
                <div className="mt-4">
                  <p
                    className="mb-2 text-[12px] font-bold uppercase tracking-[1.2px]"
                    style={{ color: "var(--shbz-kicker)" }}
                  >
                    Осн. задания
                  </p>
                  <ol className="space-y-2">
                    {mainItems.map((item, index) => {
                      const reason = reasonMeta[item.reason] ?? reasonMeta.NEW;
                      const status = item.studentStatus
                        ? statusMeta[item.studentStatus]
                        : null;

                      return (
                        <li
                          key={item.id}
                          tabIndex={0}
                          data-lesson-item
                          onKeyDown={(event) =>
                            handleItemKeyDown(event, participant.id, item)
                          }
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border px-3.5 py-2.5"
                          style={{
                            borderColor: "var(--shbz-soft-border)",
                            background: "var(--shbz-soft-bg)",
                          }}
                        >
                          <span
                            className="text-xs font-bold"
                            style={{ color: "var(--shbz-kicker)" }}
                          >
                            {index + 1}.
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: "var(--shbz-text-strong)" }}
                          >
                            № {item.number}
                          </span>
                          {item.difficulty ? (
                            <span
                              className="shbz-chip"
                              style={{
                                background: "var(--shbz-tab-hover)",
                                color: "var(--shbz-kicker)",
                                padding: "3px 9px",
                              }}
                            >
                              сложн. {item.difficulty}
                            </span>
                          ) : null}
                          <span
                            className="shbz-chip"
                            style={{
                              background: reason.background,
                              color: reason.color,
                              padding: "3px 9px",
                            }}
                          >
                            {reason.label}
                          </span>
                          {status && !item.result ? (
                            <span
                              className="shbz-chip"
                              style={{
                                background: status.background,
                                color: status.color,
                                padding: "3px 9px",
                              }}
                            >
                              {status.label}
                            </span>
                          ) : null}
                          <ResultToggle
                            className="ml-auto"
                            size="lg"
                            value={item.result}
                            disabled={busy}
                            onChange={(next) =>
                              void setResult(participant.id, item.id, next)
                            }
                          />
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Убрать № ${item.number}`}
                            onClick={() => removeItem(item)}
                            className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-[8px] text-[18px] leading-none opacity-60 transition hover:opacity-100"
                            style={{ color: "var(--shbz-danger-text)" }}
                          >
                            ×
                          </button>
                          {renderSubmissionInfo(item, spentByItemId.get(item.id))}
                          <div className="w-full">
                            <ProgressStatusHistory studentId={participant.studentId} homeworkNumberId={item.homeworkNumberId} refreshKey={`${item.result}:${historyVersion}`} />
                          </div>
                          {itemErrors[item.id] ? (
                            <span
                              className="w-full text-xs font-semibold"
                              style={{ color: "var(--shbz-danger-text)" }}
                            >
                              {itemErrors[item.id]}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : !pending ? (
                <p
                  className="mt-4 text-sm"
                  style={{ color: "var(--shbz-text-muted)" }}
                >
                  Задач пока нет — добавьте вручную или запустите подбор.
                </p>
              ) : null}

              {extraItems.length > 0 ? (
                <div className="mt-4">
                  <p
                    className="mb-2 text-[12px] font-bold uppercase tracking-[1.2px]"
                    style={{ color: "var(--shbz-kicker)" }}
                  >
                    Доп. задания
                  </p>
                  <ol className="space-y-2">
                    {extraItems.map((item, index) => {
                      const reason = reasonMeta[item.reason] ?? reasonMeta.NEW;

                      return (
                        <li
                          key={item.id}
                          tabIndex={0}
                          data-lesson-item
                          onKeyDown={(event) =>
                            handleItemKeyDown(event, participant.id, item)
                          }
                          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[12px] border border-dashed px-3.5 py-2.5"
                          style={{ borderColor: "var(--shbz-soft-border)" }}
                        >
                          {/* Нумерация сквозная: доп. часть продолжает основную. */}
                          <span
                            className="text-xs font-bold"
                            style={{ color: "var(--shbz-kicker)" }}
                          >
                            {mainItems.length + index + 1}.
                          </span>
                          <span
                            className="text-sm font-bold"
                            style={{ color: "var(--shbz-text-strong)" }}
                          >
                            № {item.number}
                          </span>
                          {item.difficulty ? (
                            <span
                              className="shbz-chip"
                              style={{
                                background: "var(--shbz-tab-hover)",
                                color: "var(--shbz-kicker)",
                                padding: "3px 9px",
                              }}
                            >
                              сложн. {item.difficulty}
                            </span>
                          ) : null}
                          <span
                            className="shbz-chip"
                            style={{
                              background: reason.background,
                              color: reason.color,
                              padding: "3px 9px",
                            }}
                          >
                            {reason.label}
                          </span>
                          <ResultToggle
                            className="ml-auto"
                            size="lg"
                            value={item.result}
                            disabled={busy}
                            onChange={(next) =>
                              void setResult(participant.id, item.id, next)
                            }
                          />
                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Убрать № ${item.number}`}
                            onClick={() => removeItem(item)}
                            className="ml-1.5 flex h-8 w-8 items-center justify-center rounded-[8px] text-[18px] leading-none opacity-60 transition hover:opacity-100"
                            style={{ color: "var(--shbz-danger-text)" }}
                          >
                            ×
                          </button>
                          {renderSubmissionInfo(item, spentByItemId.get(item.id))}
                          <div className="w-full">
                            <ProgressStatusHistory studentId={participant.studentId} homeworkNumberId={item.homeworkNumberId} refreshKey={`${item.result}:${historyVersion}`} />
                          </div>
                          {itemErrors[item.id] ? (
                            <span
                              className="w-full text-xs font-semibold"
                              style={{ color: "var(--shbz-danger-text)" }}
                            >
                              {itemErrors[item.id]}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}

              <LessonManualAdd
                bank={bank}
                busy={busy}
                existingIds={participant.items.map(
                  (item) => item.homeworkNumberId,
                )}
                onAdd={(homeworkNumberId, toExtra) =>
                  void saveItems(
                    participant.id,
                    toExtra ? mainIds : [...mainIds, homeworkNumberId],
                    toExtra ? [...extraIds, homeworkNumberId] : extraIds,
                  )
                }
              />
            </article>
          );
        })}
      </div>

      {undoState ? (
        // Центрирование на внешнем слое: вход ui-pop-in анимирует transform
        // и не должен конфликтовать с translate-центровкой.
        <div className="pointer-events-none fixed bottom-6 left-0 right-0 z-40 flex justify-center">
          <div
            role="status"
            className="ui-pop-in pointer-events-auto flex items-center gap-3 rounded-[12px] border px-4 py-3 text-sm font-semibold shadow-lg"
            style={{
              background: "var(--shbz-card-bg)",
              borderColor: "var(--shbz-card-border)",
              color: "var(--shbz-text-strong)",
            }}
          >
            {undoState.label}
            <button
              type="button"
              className="font-bold underline"
              style={{ color: "var(--shbz-accent-solid)" }}
              onClick={() => {
                if (undoTimer.current) {
                  clearTimeout(undoTimer.current);
                  undoTimer.current = null;
                }

                void saveItems(
                  undoState.participantId,
                  undoState.mainIds,
                  undoState.extraIds,
                );
                setUndoState(null);
              }}
            >
              Отменить
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
