"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { canSubmitLessonItem, isExtraPartUnlocked, isLessonItemClosed, LESSON_SUBMISSION_MAX_PHOTOS } from "@/lib/lesson-live";

const POLL_BASE_DELAY_MS = 4000;
const MAX_POLL_FAILURES = 5;

type LessonSubmissionSnapshot = {
  id: string;
  itemId: string;
  status: "PENDING" | "CHECKING" | "DONE" | "FAILED";
  verdict: "CORRECT" | "INCORRECT" | "UNCERTAIN" | null;
  recognizedAnswer: string | null;
  comment: string | null;
  error: string | null;
  submittedAt: string;
  checkedAt: string | null;
};

type LessonViewItem = {
  id: string;
  number: string;
  isExtra: boolean;
  result: string | null;
  conditionLatex: string | null;
  topicTitle: string;
  submission: LessonSubmissionSnapshot | null;
};

type StudentLessonViewProps = {
  lessonId: string;
  startsAt: string | null;
  durationMinutes: number;
  items: LessonViewItem[];
};

// Итог, выставленный учителем, — тот же статусный канал, что и вердикт ИИ.
const resultMeta: Record<string, { label: string; background: string; color: string }> = {
  SOLVED: { label: "Принято", background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" },
  PARTIAL: { label: "С ошибками", background: "var(--shbz-yellow-soft)", color: "var(--shbz-yellow-text)" },
  NOT_SOLVED: { label: "Перерешай", background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" },
  SKIPPED: { label: "Не успел", background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }
};

const verdictMeta: Record<string, { label: string; background: string; color: string }> = {
  CORRECT: { label: "Верно", background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" },
  INCORRECT: { label: "Перерешай", background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" },
  UNCERTAIN: { label: "Проверит учитель", background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }
};

function toLiveState(item: LessonViewItem) {
  return {
    isExtra: item.isExtra,
    result: item.result,
    latestVerdict: item.submission?.status === "DONE" ? item.submission.verdict : null
  };
}

function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function StudentLessonView({ lessonId, startsAt, durationMinutes, items }: StudentLessonViewProps) {
  const router = useRouter();
  const [submissionByItemId, setSubmissionByItemId] = useState<Record<string, LessonSubmissionSnapshot>>(() => {
    const initial: Record<string, LessonSubmissionSnapshot> = {};

    for (const item of items) {
      if (item.submission) {
        initial[item.id] = item.submission;
      }
    }

    return initial;
  });
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [pollBroken, setPollBroken] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollFailuresRef = useRef(0);
  const joinedRef = useRef(false);
  // Зеркало снапшота для поллера: сравнение «стало терминальным» не должно
  // жить внутри setState-апдейтера (он выполняется не в момент вызова).
  const submissionsRef = useRef(submissionByItemId);

  useEffect(() => {
    submissionsRef.current = submissionByItemId;
  }, [submissionByItemId]);

  // Свежие пропсы с сервера (router.refresh) перекрывают локальный снапшот.
  useEffect(() => {
    setSubmissionByItemId((current) => {
      const next = { ...current };

      for (const item of items) {
        if (item.submission) {
          const known = next[item.id];

          if (!known || known.submittedAt <= item.submission.submittedAt) {
            next[item.id] = item.submission;
          }
        }
      }

      return next;
    });
  }, [items]);

  // «Я в классе»: один раз на открытие вкладки урока.
  useEffect(() => {
    if (joinedRef.current) {
      return;
    }

    joinedRef.current = true;
    void fetch("/api/student/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId })
    }).catch(() => undefined);
  }, [lessonId]);

  // Урок закончится по расписанию — страница перерисуется в пустое состояние сама.
  useEffect(() => {
    if (!startsAt) {
      return;
    }

    const endsAt = new Date(startsAt).getTime() + Math.max(0, durationMinutes) * 60_000;
    const delay = endsAt - Date.now();

    if (delay <= 0) {
      return;
    }

    const timer = setTimeout(() => router.refresh(), delay + 1000);

    return () => clearTimeout(timer);
  }, [startsAt, durationMinutes, router]);

  const liveItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        submission: submissionByItemId[item.id] ?? item.submission
      })),
    [items, submissionByItemId]
  );

  const isRunning =
    !pollBroken &&
    liveItems.some(
      (item) => item.submission?.status === "PENDING" || item.submission?.status === "CHECKING"
    );

  const poll = useCallback(async () => {
    let failed = false;
    let sawTerminalChange = false;

    try {
      const response = await fetch(
        `/api/student/lesson-submissions?lessonId=${encodeURIComponent(lessonId)}&consume=1`,
        { cache: "no-store" }
      );
      const result = (await response.json().catch(() => null)) as
        | { submissions?: LessonSubmissionSnapshot[] }
        | null;

      if (response.ok && result?.submissions) {
        pollFailuresRef.current = 0;
        const fresh = result.submissions;
        const known = submissionsRef.current;

        for (const submission of fresh) {
          const previous = known[submission.itemId];

          if (
            previous &&
            previous.id === submission.id &&
            previous.status !== submission.status &&
            (submission.status === "DONE" || submission.status === "FAILED")
          ) {
            sawTerminalChange = true;
          }
        }

        setSubmissionByItemId((current) => {
          const next = { ...current };

          for (const submission of fresh) {
            next[submission.itemId] = submission;
          }

          return next;
        });

        if (sawTerminalChange) {
          router.refresh();
        }
      } else {
        failed = true;
      }
    } catch {
      failed = true;
    }

    if (failed) {
      pollFailuresRef.current += 1;

      if (pollFailuresRef.current >= MAX_POLL_FAILURES) {
        setPollBroken(true);
        return;
      }
    }

    const delay = POLL_BASE_DELAY_MS * Math.min(2 ** pollFailuresRef.current, 8);
    pollTimerRef.current = setTimeout(() => void poll(), delay);
  }, [lessonId, router]);

  useEffect(() => {
    if (isRunning && !pollTimerRef.current) {
      pollTimerRef.current = setTimeout(() => void poll(), POLL_BASE_DELAY_MS);
    }

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isRunning, poll]);

  const submitPhotos = useCallback(
    async (item: LessonViewItem, files: FileList | null) => {
      if (!files || files.length === 0) {
        return;
      }

      setUploadingItemId(item.id);
      setItemErrors((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });

      try {
        const formData = new FormData();
        formData.append("itemId", item.id);

        for (const file of Array.from(files)) {
          formData.append("files", file);
        }

        const response = await fetch("/api/student/lesson-submissions", {
          method: "POST",
          body: formData
        });
        const result = (await response.json().catch(() => null)) as
          | { error?: string; submissionId?: string }
          | null;

        if (!response.ok) {
          throw new Error(result?.error || "Не удалось сдать решение.");
        }

        setPollBroken(false);
        pollFailuresRef.current = 0;
        setSubmissionByItemId((current) => ({
          ...current,
          [item.id]: {
            id: result?.submissionId ?? `local-${Date.now()}`,
            itemId: item.id,
            status: "PENDING",
            verdict: null,
            recognizedAnswer: null,
            comment: null,
            error: null,
            submittedAt: new Date().toISOString(),
            checkedAt: null
          }
        }));
      } catch (error) {
        setItemErrors((current) => ({
          ...current,
          [item.id]: error instanceof Error ? error.message : "Не удалось сдать решение."
        }));
      } finally {
        setUploadingItemId(null);
      }
    },
    []
  );

  const mainItems = liveItems.filter((item) => !item.isExtra);
  const extraItems = liveItems.filter((item) => item.isExtra);
  const liveStates = liveItems.map(toLiveState);
  const extraUnlocked = isExtraPartUnlocked(liveStates);
  const closedMainCount = mainItems.filter((item) => isLessonItemClosed(toLiveState(item))).length;

  const renderItem = (item: LessonViewItem, index: number, locked: boolean) => {
    const submission = item.submission;
    const state = toLiveState(item);
    const checking = submission?.status === "PENDING" || submission?.status === "CHECKING";
    const canSubmit = !locked && !checking && canSubmitLessonItem(state);
    const resultChip = item.result ? resultMeta[item.result] : null;
    const verdictChip =
      !resultChip && submission?.status === "DONE" && submission.verdict ? verdictMeta[submission.verdict] : null;

    return (
      <article key={item.id} className="shbz-card p-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold" style={{ color: "var(--shbz-kicker)" }}>
            {index + 1}.
          </span>
          <h3 className="text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            № {item.number}
          </h3>
          <span className="shbz-chip" style={{ background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)", padding: "3px 9px" }}>
            {item.topicTitle}
          </span>
          {resultChip ? (
            <span className="shbz-chip" style={{ background: resultChip.background, color: resultChip.color, padding: "3px 9px" }}>
              {resultChip.label}
            </span>
          ) : verdictChip ? (
            <span className="shbz-chip" style={{ background: verdictChip.background, color: verdictChip.color, padding: "3px 9px" }}>
              {verdictChip.label}
            </span>
          ) : null}
          {checking ? (
            <span
              role="status"
              className="inline-flex items-center gap-2 text-xs font-semibold"
              style={{ color: "var(--shbz-text-muted)" }}
            >
              <span className="shbz-spinner" style={{ color: "var(--shbz-accent-solid)" }} aria-hidden />
              Проверяется…
            </span>
          ) : submission ? (
            <span className="text-xs" style={{ color: "var(--shbz-text-soft)" }}>
              сдано в {formatClockTime(submission.submittedAt)}
            </span>
          ) : null}
        </div>

        {item.conditionLatex ? (
          <div className="mt-3">
            <LatexAnswerPreview value={item.conditionLatex} />
          </div>
        ) : null}

        {submission?.status === "DONE" && submission.comment ? (
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
            {submission.comment}
          </p>
        ) : null}

        {submission?.status === "FAILED" ? (
          <p className="mt-3 text-sm" style={{ color: "var(--shbz-danger-text)" }}>
            {submission.error || "Проверка не удалась. Сдайте номер заново."}
          </p>
        ) : null}

        {itemErrors[item.id] ? (
          <div className="ui-notice-error mt-3 rounded-[8px] px-4 py-3 text-sm">{itemErrors[item.id]}</div>
        ) : null}

        {canSubmit ? (
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <label className="shbz-btn-outline inline-flex cursor-pointer items-center gap-2">
              {uploadingItemId === item.id ? (
                <>
                  <span className="shbz-spinner" aria-hidden />
                  Загружаем…
                </>
              ) : submission ? (
                `Пересдать № ${item.number}`
              ) : (
                `Сдать фото № ${item.number}`
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                capture="environment"
                multiple
                disabled={uploadingItemId !== null}
                className="sr-only"
                aria-label={`Сдать фото решения № ${item.number}`}
                onChange={(event) => {
                  void submitPhotos(item, event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <span className="ui-hint text-xs" style={{ color: "var(--shbz-kicker)" }}>
              До {LESSON_SUBMISSION_MAX_PHOTOS} фото · PNG или JPG
            </span>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <div>
      <p className="-mt-7 mb-6 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
        Закрыто {closedMainCount} из {mainItems.length} в основной части. Сдавайте решение фото — проверка
        подскажет результат, спорные номера посмотрит учитель.
      </p>

      {pollBroken ? (
        <p className="mb-5 text-sm" style={{ color: "var(--shbz-danger-text)" }}>
          Не получается узнать статус проверки — соединение с сервером прерывается. Обновите страницу через
          минуту.
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="shbz-section-title">Основная часть</h2>
        {mainItems.length > 0 ? (
          mainItems.map((item, index) => renderItem(item, index, false))
        ) : (
          <p className="text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Учитель ещё не собрал набор — подождите минуту и обновите страницу.
          </p>
        )}
      </section>

      {extraItems.length > 0 ? (
        <section className="mt-9 space-y-4">
          <h2 className="shbz-section-title">Дополнительная часть</h2>
          {extraUnlocked ? (
            extraItems.map((item, index) => renderItem(item, index, false))
          ) : (
            <div className="shbz-card p-6">
              <p className="text-sm font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                Откроется, когда будет закрыта основная часть
              </p>
              <p className="ui-hint mt-1.5 text-xs" style={{ color: "var(--shbz-kicker)" }}>
                Ещё {mainItems.length - closedMainCount}{" "}
                {mainItems.length - closedMainCount === 1 ? "номер" : "номера(ов)"} — и дополнительные задачи
                станут доступны.
              </p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
