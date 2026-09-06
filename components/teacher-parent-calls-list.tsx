"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/utils";
import type { ParentCallStudentOverview } from "@/lib/parent-calls";

/*
 * Раздел «Звонки родителям»: список учеников с состоянием напоминания,
 * inline-развёртки формы фиксации звонка и истории (не модалки). Вёрстка и
 * копирайтинг — по контракту .planning/phases/02-feature/02-UI-SPEC.md.
 * Комментарии — персональные данные: видны только здесь (учитель/разработчик).
 */

// Подсветка строки из уведомления живёт полторы секунды (решение владельца).
const HIGHLIGHT_FLASH_MS = 1500;

type TeacherParentCallsListProps = {
  students: ParentCallStudentOverview[];
  /** DEVELOPER видит всех учеников с колонкой учителя и не фиксирует звонки. */
  isDeveloper: boolean;
  studentsHref: string;
  /** Ученик из уведомления (?studentId=…): строка подсвечивается и прокручивается в вид. */
  highlightStudentId?: string | null;
};

const DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow"
});

function chipFor(state: ParentCallStudentOverview["reminder"]["state"]) {
  if (state === "overdue") {
    return <span className="shbz-chip shbz-chip--row shbz-chip-red md:w-full">Просрочено</span>;
  }

  if (state === "due") {
    return <span className="shbz-chip shbz-chip--row shbz-chip-yellow md:w-full">Пора позвонить</span>;
  }

  return <span className="shbz-badge-muted shbz-chip--row md:w-full">Созвонились недавно</span>;
}

function metaFor(student: ParentCallStudentOverview) {
  const parts: string[] = [];

  if (student.lastReachedAt) {
    const days = student.reminder.daysSinceAnchor;
    parts.push(
      `Последний звонок: ${DATE_FORMAT.format(new Date(student.lastReachedAt))} (${days === 0 ? "сегодня" : `${days} дн. назад`})`
    );
  } else {
    parts.push(`Звонков ещё не было · ученик добавлен ${DATE_FORMAT.format(new Date(student.studentCreatedAt))}`);
  }

  // Дни считаются на сервере (календарно, Мск) — в рендере часов нет,
  // иначе SSR и гидрация могли бы разойтись на границе суток.
  if (student.attemptAfterLastReached && student.attemptDaysAgo !== null) {
    parts.push(
      `Пытались дозвониться ${student.attemptDaysAgo === 0 ? "сегодня" : `${student.attemptDaysAgo} дн. назад`}`
    );
  }

  return parts.join(" · ");
}

type CallFormProps = {
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
};

function CallForm({ studentId, onClose, onSaved }: CallFormProps) {
  const [outcome, setOutcome] = useState<"REACHED" | "NO_ANSWER">("REACHED");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/teacher/parent-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, outcome, comment })
      });

      if (!response.ok) {
        // Сервер отвечает осмысленным русским текстом (лимит, «ученик не
        // найден» и т.п.) — показываем его, а не общую фразу про соединение.
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Не удалось сохранить звонок. Проверьте соединение и попробуйте ещё раз.");
      }

      onSaved();
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Не удалось сохранить звонок. Проверьте соединение и попробуйте ещё раз."
      );
      setIsSaving(false);
    }
  };

  return (
    <div
      className="ui-fade-slide mt-1 mb-5 rounded-[12px] border px-5 py-5"
      style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
    >
      <div className="shbz-seg inline-flex" role="group" aria-label="Исход звонка">
        <button
          type="button"
          data-active={outcome === "REACHED"}
          aria-pressed={outcome === "REACHED"}
          disabled={isSaving}
          onClick={() => setOutcome("REACHED")}
          className="shbz-seg-btn shbz-seg-btn--plain disabled:cursor-not-allowed"
        >
          Дозвонились
        </button>
        <button
          type="button"
          data-active={outcome === "NO_ANSWER"}
          aria-pressed={outcome === "NO_ANSWER"}
          disabled={isSaving}
          onClick={() => setOutcome("NO_ANSWER")}
          className="shbz-seg-btn shbz-seg-btn--plain disabled:cursor-not-allowed"
        >
          Не дозвонились
        </button>
      </div>

      <label className="mt-4 block">
        <span className="block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
          Комментарий
        </span>
        <textarea
          value={comment}
          disabled={isSaving}
          onChange={(event) => setComment(event.target.value)}
          placeholder="О чём договорились, что обсудили…"
          className="shbz-textarea mt-2 w-full"
          rows={3}
        />
      </label>
      <p className="ui-hint mt-2 text-[13px]" style={{ color: "var(--shbz-text-soft)" }}>
        Неудачная попытка сохранится в истории, но не сбросит отсчёт напоминания.
      </p>

      {error ? (
        <div className="shbz-notice-error mt-4 rounded-[12px] px-5 py-4 text-sm">{error}</div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void submit()}
          className="shbz-btn-primary px-5 disabled:cursor-not-allowed"
        >
          {isSaving ? "Сохраняем…" : "Сохранить звонок"}
        </button>
        <button type="button" disabled={isSaving} onClick={onClose} className="shbz-btn-outline">
          Отмена
        </button>
      </div>
    </div>
  );
}

function CallHistory({ student, isDeveloper }: { student: ParentCallStudentOverview; isDeveloper: boolean }) {
  return (
    <div
      className="ui-fade-slide mt-1 mb-5 rounded-[12px] border px-5 py-2"
      style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
    >
      {student.history.map((call, index) => (
        <div
          key={call.id}
          className="py-3.5"
          style={
            index < student.history.length - 1 ? { borderBottom: "1px solid var(--shbz-row-border)" } : undefined
          }
        >
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
            <span className="font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
              {DATE_TIME_FORMAT.format(new Date(call.calledAt))}
            </span>
            <span style={{ color: "var(--shbz-divider)" }}>·</span>
            <span
              className={cx(call.outcome === "REACHED" ? "font-semibold" : "font-medium")}
              style={{ color: call.outcome === "REACHED" ? "var(--shbz-text-strong)" : "var(--shbz-text-muted)" }}
            >
              {call.outcome === "REACHED" ? "Дозвонились" : "Не дозвонились"}
            </span>
            {isDeveloper && call.teacherName ? (
              <span style={{ color: "var(--shbz-text-soft)" }}>— {call.teacherName}</span>
            ) : null}
          </div>
          {call.comment ? (
            <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-[1.5]" style={{ color: "var(--shbz-text-strong)" }}>
              {call.comment}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function TeacherParentCallsList({
  students,
  isDeveloper,
  studentsHref,
  highlightStudentId = null
}: TeacherParentCallsListProps) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  // Развёртка: на строку открыта максимум одна (форма ИЛИ история).
  const [openPanel, setOpenPanel] = useState<{ studentId: string; panel: "form" | "history" } | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  // Подсветка из уведомления — кратковременная: строка вспыхивает на полторы
  // секунды и гаснет, а ?studentId= убирается из адреса, чтобы обновление
  // страницы не зажигало её снова.
  const [flashStudentId, setFlashStudentId] = useState<string | null>(highlightStudentId);

  useEffect(() => {
    if (!highlightStudentId) {
      return;
    }

    setFlashStudentId(highlightStudentId);
    highlightRef.current?.scrollIntoView({ block: "center" });

    const timer = setTimeout(() => {
      setFlashStudentId(null);

      const url = new URL(window.location.href);

      if (url.searchParams.has("studentId")) {
        url.searchParams.delete("studentId");
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
    }, HIGHLIGHT_FLASH_MS);

    return () => clearTimeout(timer);
  }, [highlightStudentId]);

  const overdueCount = students.filter((s) => s.reminder.state === "overdue").length;
  const dueCount = students.filter((s) => s.reminder.state === "due").length;

  const togglePanel = (studentId: string, panel: "form" | "history") => {
    setOpenPanel((current) =>
      current && current.studentId === studentId && current.panel === panel ? null : { studentId, panel }
    );
  };

  const onSaved = () => {
    setOpenPanel(null);
    startTransition(() => router.refresh());
  };

  if (students.length === 0) {
    return (
      <div className="shbz-card px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Пока ни одного ученика
        </p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-[1.5]" style={{ color: "var(--shbz-text-muted)" }}>
          Добавьте учеников в разделе{" "}
          <Link href={studentsHref} className="font-semibold no-underline" style={{ color: "var(--shbz-accent-solid)" }}>
            «ученики»
          </Link>{" "}
          — здесь появятся напоминания о звонках родителям.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
        Просрочено: {overdueCount} · Пора позвонить: {dueCount} · Всего учеников: {students.length}
      </p>

      <div className="ui-enter shbz-card px-7 py-2">
        <div
          className={cx(
            "hidden items-center gap-3 border-b py-[18px] md:grid",
            isDeveloper ? "md:grid-cols-[1fr_200px_128px]" : "md:grid-cols-[1fr_200px_308px]"
          )}
          style={{ borderColor: "var(--shbz-soft-border)" }}
        >
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Ученик
          </div>
          {/* Чипы статуса в строках начинаются от левого края колонки — подпись тоже. */}
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Статус
          </div>
          {/* Кнопки начинаются с левого края колонки — заголовок тоже слева, как у соседних. */}
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Действия
          </div>
        </div>

        {students.map((student, index) => {
          const isLast = index === students.length - 1;
          const open = openPanel && openPanel.studentId === student.studentId ? openPanel.panel : null;
          const isHighlighted = flashStudentId === student.studentId;

          return (
            <div
              key={student.studentId}
              ref={isHighlighted ? highlightRef : undefined}
              // Подсветка строки из уведомления: мягкая мятная заливка на всю
              // ширину карточки (компенсируем её px-7), а не кольцо вокруг
              // контента — кольцо резало соседние строки и выходило за рамку.
              className={cx("-mx-7 px-7 transition-colors duration-500")}
              style={{
                background: isHighlighted ? "var(--theme-accent-soft)" : "transparent",
                ...(!isLast ? { borderBottom: "1px solid var(--shbz-row-border)" } : null)
              }}
            >
              <div
                className={cx(
                  "flex flex-col gap-3 py-5 md:grid md:items-center md:gap-3",
                  isDeveloper ? "md:grid-cols-[1fr_200px_128px]" : "md:grid-cols-[1fr_200px_308px]"
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                    {student.studentName}
                  </div>
                  <div className="mt-1 text-[13px] leading-[1.4]" style={{ color: "var(--shbz-text-muted)" }}>
                    {metaFor(student)}
                  </div>
                  {isDeveloper ? (
                    <div className="mt-0.5 text-[13px]" style={{ color: "var(--shbz-text-soft)" }}>
                      Учитель: {student.teacherName ?? "—"}
                    </div>
                  ) : null}
                </div>

                {/* Фиксированные колонки (ширины под Montserrat, подписи nowrap):
                    строки-сетки независимы, иначе кнопки гуляют по горизонтали.
                    Чип статуса растянут на колонку и по высоте, радиусу и зазору
                    (12px) не отличается от кнопок действий — одна линейка. */}
                <div>{chipFor(student.reminder.state)}</div>

                <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
                  {!isDeveloper ? (
                    <button
                      type="button"
                      disabled={isRefreshing}
                      onClick={() => togglePanel(student.studentId, "form")}
                      aria-expanded={open === "form"}
                      className="shbz-btn-primary px-5 disabled:cursor-not-allowed"
                      style={{ boxShadow: "0 5px 14px var(--shbz-accent-shadow)" }}
                    >
                      Записать звонок
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={student.totalCalls === 0}
                    onClick={() => togglePanel(student.studentId, "history")}
                    aria-expanded={open === "history"}
                    className="shbz-btn-outline min-w-[128px] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    История ({student.totalCalls > 0 ? student.totalCalls : "—"})
                  </button>
                </div>
              </div>

              {open === "form" ? (
                <CallForm studentId={student.studentId} onClose={() => setOpenPanel(null)} onSaved={onSaved} />
              ) : null}
              {open === "history" ? <CallHistory student={student} isDeveloper={isDeveloper} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
