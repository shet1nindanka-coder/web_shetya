"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { humanizeSolutionCheckError } from "@/lib/solution-check-error-text";
import { formatDateTime } from "@/lib/utils";

const POLL_BASE_DELAY_MS = 4000;
const MAX_POLL_FAILURES = 5;

type CheckResult = {
  number: string;
  verdict: "CORRECT" | "INCORRECT" | "UNCERTAIN";
  recognizedAnswer: string | null;
  comment: string | null;
};

type CheckSnapshot = {
  id: string;
  status: "PENDING" | "CHECKING" | "DONE" | "FAILED";
  error: string | null;
  checkedAt: string | null;
  results: CheckResult[];
};

type StudentHomeworkCheckProps = {
  assignmentId: string;
  hasPhotos: boolean;
  initialCheck: CheckSnapshot | null;
};

const verdictMeta: Record<
  CheckResult["verdict"],
  { label: string; color: string; background: string; stripe: string }
> = {
  CORRECT: { label: "Верно", color: "var(--shbz-green-text)", background: "var(--shbz-green-soft)", stripe: "#36e0a4" },
  INCORRECT: { label: "Перерешай", color: "var(--shbz-danger-text)", background: "var(--shbz-danger-bg)", stripe: "var(--shbz-danger-text)" },
  UNCERTAIN: { label: "Не распознано — проверит учитель", color: "var(--shbz-kicker)", background: "var(--shbz-tab-hover)", stripe: "var(--shbz-kicker)" }
};

function shortenRecognizedAnswer(answer: string): string {
  const trimmed = answer.trim();
  const parts = trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 5 && trimmed.length > 80) {
    return `${parts[0]}; ${parts[1]}; …; ${parts[parts.length - 1]}`;
  }

  if (trimmed.length > 140) {
    return `${trimmed.slice(0, 137).trimEnd()}…`;
  }

  return trimmed;
}

export function StudentHomeworkCheck({ assignmentId, hasPhotos, initialCheck }: StudentHomeworkCheckProps) {
  const router = useRouter();
  const [check, setCheck] = useState<CheckSnapshot | null>(initialCheck);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollBroken, setPollBroken] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollFailuresRef = useRef(0);

  const isRunning = !pollBroken && (check?.status === "PENDING" || check?.status === "CHECKING");

  const doneResults = check?.status === "DONE" ? check.results : [];
  const correctCount = doneResults.filter((result) => result.verdict === "CORRECT").length;
  const incorrectCount = doneResults.filter((result) => result.verdict === "INCORRECT").length;
  const uncertainCount = doneResults.filter((result) => result.verdict === "UNCERTAIN").length;

  const poll = useCallback(async () => {
    let failed = false;

    try {
      const response = await fetch(
        `/api/student/homework-checks?assignmentId=${encodeURIComponent(assignmentId)}&consume=1`,
        { cache: "no-store" }
      );
      const result = (await response.json().catch(() => null)) as { check?: CheckSnapshot | null } | null;

      if (response.ok && result) {
        pollFailuresRef.current = 0;
        const nextCheck = result.check ?? null;
        setCheck(nextCheck);

        if (nextCheck && (nextCheck.status === "DONE" || nextCheck.status === "FAILED")) {
          router.refresh();
          return;
        }
      } else {
        // 401/429/500 — не «пробуем вечно»: считаем неудачи и растим паузу.
        failed = true;
      }
    } catch {
      failed = true;
    }

    if (failed) {
      pollFailuresRef.current += 1;

      if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
        // Терминальное состояние вместо вечного «Проверяется…».
        setPollBroken(true);
        return;
      }
    }

    const delay = POLL_BASE_DELAY_MS * Math.min(2 ** pollFailuresRef.current, 8);
    pollTimerRef.current = setTimeout(() => void poll(), delay);
  }, [assignmentId, router]);

  useEffect(() => {
    if (isRunning && !pollTimerRef.current) {
      pollTimerRef.current = setTimeout(() => void poll(), 4000);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isRunning, poll]);

  // «Перерешать №N»: ведёт к карточке номера ниже на странице — там условие
  // и заметка; после замены фото проверку можно запустить заново.
  const scrollToNumber = (number: string) => {
    const target = document.getElementById(`number-${number}`);

    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  const startCheck = async () => {
    setIsStarting(true);
    setError(null);
    setPollBroken(false);
    pollFailuresRef.current = 0;

    try {
      const response = await fetch("/api/student/homework-checks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ assignmentId })
      });

      const result = (await response.json().catch(() => null)) as { error?: string; checkId?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error || "Не удалось запустить проверку.");
      }

      setCheck({ id: result?.checkId ?? "", status: "PENDING", error: null, checkedAt: null, results: [] });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Не удалось запустить проверку.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    // Без собственной карточки: на странице ДЗ фото и автопроверка живут в одной плашке.
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold tracking-[-0.3px]" style={{ color: "var(--shbz-text-strong)" }}>
            Автоматическая проверка
          </h2>
          <p className="ui-hint mt-1 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Сверит фото с эталонными ответами
          </p>
        </div>
        <button
          type="button"
          disabled={!hasPhotos || isStarting || isRunning}
          onClick={() => void startCheck()}
          title={hasPhotos ? undefined : "Сначала прикрепите фото решения"}
          className="shbz-btn-primary px-5 py-2.5 text-[14px] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? "Проверяется..." : isStarting ? "Запускаем..." : "Проверить решение"}
        </button>
      </div>

      {error ? <div className="ui-notice-error mt-4 px-4 py-3 text-sm">{error}</div> : null}

      {/* Живой регион: скринридер узнаёт о запуске и завершении многоминутной проверки. */}
      <p role="status" className="sr-only">
        {isRunning
          ? "Проверка решения выполняется."
          : check?.status === "DONE"
            ? `Проверка завершена. Верно: ${correctCount}, перерешать: ${incorrectCount}, на проверке учителя: ${uncertainCount}.`
            : check?.status === "FAILED"
              ? "Проверка не удалась."
              : ""}
      </p>

      {isRunning ? (
        <p className="mt-4 text-sm font-semibold" style={{ color: "var(--shbz-kicker)" }}>
          Решение проверяется — обычно это занимает до минуты. Страница обновится сама.
        </p>
      ) : null}

      {pollBroken ? (
        <p className="mt-4 text-sm" style={{ color: "var(--shbz-danger-text)" }}>
          Не получается узнать статус проверки — соединение с сервером прерывается. Обновите страницу через минуту.
        </p>
      ) : null}

      {check?.status === "FAILED" ? (
        <p className="mt-4 text-sm" style={{ color: "var(--shbz-danger-text)" }}>
          {humanizeSolutionCheckError(check.error)}
        </p>
      ) : null}

      {check?.status === "DONE" && check.results.length > 0 ? (
        <div className="mt-5">
          {check.checkedAt ? (
            <p className="mb-2 text-xs font-semibold" style={{ color: "var(--shbz-kicker)" }}>
              Проверено: {formatDateTime(check.checkedAt)}
            </p>
          ) : null}
          <div className="mb-3 flex flex-wrap gap-2">
            {correctCount > 0 ? (
              <span
                className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-bold"
                style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
              >
                Верно {correctCount}
              </span>
            ) : null}
            {incorrectCount > 0 ? (
              <span
                className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-bold"
                style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}
              >
                <span aria-hidden="true">✗ </span>
                Перерешать {incorrectCount}
              </span>
            ) : null}
            {uncertainCount > 0 ? (
              <span
                className="rounded-[8px] px-2.5 py-1 text-[12.5px] font-bold"
                style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-text-muted)" }}
              >
                <span aria-hidden="true">⏳ </span>
                На проверке учителя {uncertainCount}
              </span>
            ) : null}
          </div>

          <div className="space-y-2.5">
            {check.results.map((result) => {
              const meta = verdictMeta[result.verdict];
              const showAnswer = result.verdict !== "UNCERTAIN" && Boolean(result.recognizedAnswer);

              return (
                <div
                  key={result.number}
                  className="rounded-[12px] border border-l-[3px] px-4 py-3"
                  style={{
                    borderColor: "var(--shbz-soft-border)",
                    borderLeftColor: meta.stripe,
                    background: "var(--shbz-card-bg)"
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                      № {result.number}
                    </span>
                    <span
                      className="rounded-[8px] px-2.5 py-0.5 text-[11.5px] font-bold"
                      style={{ background: meta.background, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {showAnswer ? (
                      <span
                        className="min-w-0 text-xs"
                        style={{ color: "var(--shbz-text-muted)" }}
                        title={result.recognizedAnswer ?? undefined}
                      >
                        Ответ: {shortenRecognizedAnswer(result.recognizedAnswer ?? "")}
                      </span>
                    ) : null}
                  </div>
                  {result.comment ? (
                    <p className="mt-1.5 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
                      {result.comment}
                    </p>
                  ) : null}
                  {result.verdict === "INCORRECT" ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => scrollToNumber(result.number)}
                        className="shbz-btn-outline"
                      >
                        Перерешать № {result.number}
                      </button>
                      <span className="ui-hint text-xs" style={{ color: "var(--shbz-kicker)" }}>
                        Затем замените фото с решением и запустите проверку ещё раз.
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
