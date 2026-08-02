"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { TOPIC_IMPORT_PROMPT } from "@/lib/topic-import-prompt";

type PreviewNumber = {
  number: number;
  conditionLatex: string;
  answerLatex: string | null;
};

type PreviewResponse = {
  fileTitle: string;
  totalInFile: number;
  willAddNumbers: number;
  willFillEmpty: number;
  willOverwrite: number;
  untouched: number;
  sample: PreviewNumber[];
  warnings: string[];
  issues: string[];
};

type ApplyResponse = {
  created: number;
  filled: number;
  overwritten: number;
  skipped: number;
};

type TopicImportPanelProps = {
  topicId: string;
};

const BUTTON_PRIMARY =
  "ui-pressable ui-button-primary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
const BUTTON_SECONDARY =
  "ui-pressable ui-button-secondary rounded-[12px] px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

function SummaryTile({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="ui-card-soft rounded-[14px] px-3.5 py-3">
      <div className="ui-kicker">{label}</div>
      <div
        className="mt-1 text-lg font-bold"
        style={{ color: danger && value > 0 ? "var(--theme-danger-text)" : "var(--theme-text-strong)" }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Импорт номеров с условиями и ответами из JSON, который выдаёт внешняя ИИ
 * по промпту из lib/topic-import-prompt.ts. Предпросмотр обязателен: он
 * показывает, сколько заполненных полей затрётся, до записи в базу.
 */
export function TopicImportPanel({ topicId }: TopicImportPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [overwriteFilled, setOverwriteFilled] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetResults() {
    setPreview(null);
    setApplied(null);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(TOPIC_IMPORT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Браузер не дал доступ к буферу обмена — скопируйте текст промпта вручную.");
    }
  }

  async function readFile(file: File) {
    setError(null);
    resetResults();

    try {
      setRawJson(await file.text());
    } catch {
      setError("Не удалось прочитать файл.");
    }
  }

  async function send(mode: "preview" | "apply") {
    setError(null);
    setPending(true);

    let payload: unknown;

    try {
      payload = JSON.parse(rawJson);
    } catch {
      setPending(false);
      setError("Это не похоже на JSON. Скопируйте ответ модели целиком, без пояснений вокруг.");
      return;
    }

    try {
      const response = await fetch("/api/teacher/topic-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, payload, topicId, overwriteFilled })
      });

      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Импорт не удался. Попробуйте ещё раз.");
        return;
      }

      if (mode === "preview") {
        setPreview(data as unknown as PreviewResponse);
        setApplied(null);
        return;
      }

      setApplied(data as unknown as ApplyResponse);
      setPreview(null);
      setRawJson("");
      setOverwriteFilled(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
    } catch {
      setError("Сервер не ответил. Проверьте соединение и попробуйте снова.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="ui-panel-soft space-y-3 rounded-[16px] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BUTTON_SECONDARY} onClick={() => setPromptOpen((open) => !open)}>
            {promptOpen ? "Скрыть промпт" : "Показать промпт для ИИ"}
          </button>
          {promptOpen ? (
            <button type="button" className={BUTTON_PRIMARY} onClick={() => void copyPrompt()}>
              Скопировать промпт
            </button>
          ) : null}
          {copied ? (
            <span className="text-sm font-semibold" style={{ color: "var(--theme-success-text)" }}>
              Скопировано
            </span>
          ) : null}
        </div>

        <p className="ui-hint">
          Откройте любой чат с ИИ, который умеет читать файлы, приложите задачник и отправьте промпт. Ответ
          модели сохраните как файл <code>.json</code> или вставьте текстом ниже.
        </p>

        {promptOpen ? (
          <pre className="ui-card-soft max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[14px] px-3.5 py-3 text-xs leading-5 text-[var(--theme-text-muted)]">
            {TOPIC_IMPORT_PROMPT}
          </pre>
        ) : null}
      </div>

      <div className="ui-panel-soft space-y-3 rounded-[16px] p-3.5 sm:space-y-4 sm:p-4">
        <label className="block space-y-1.5">
          <span className="ui-form-label">Файл импорта</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,.txt"
            className="ui-input w-full rounded-[8px] px-3.5 py-2.5"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void readFile(file);
              }
            }}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="ui-form-label">…или вставьте JSON текстом</span>
          <textarea
            rows={5}
            value={rawJson}
            placeholder='{"formatVersion": 1, "topic": {...}, "numbers": [...]}'
            className="ui-input w-full rounded-[8px] px-3.5 py-2.5 font-mono text-xs"
            onChange={(event) => {
              setRawJson(event.target.value);
              resetResults();
            }}
          />
        </label>

        <button
          type="button"
          className={BUTTON_PRIMARY}
          disabled={pending || !rawJson.trim()}
          onClick={() => void send("preview")}
        >
          {pending ? "Проверяем…" : "Проверить файл"}
        </button>
      </div>

      {error ? <div className="ui-notice-error">{error}</div> : null}

      {preview ? (
        <div className="ui-panel-soft space-y-4 rounded-[16px] p-3.5 ui-fade-slide sm:p-4">
          <div className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
            Файл «{preview.fileTitle}», задач внутри: {preview.totalInFile}
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            <SummaryTile label="Добавим" value={preview.willAddNumbers} />
            <SummaryTile label="Заполним пустых" value={preview.willFillEmpty} />
            <SummaryTile label="Перезапишем" value={preview.willOverwrite} danger />
            <SummaryTile label="Без изменений" value={preview.untouched} />
          </div>

          {preview.willOverwrite > 0 ? (
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1"
                checked={overwriteFilled}
                onChange={(event) => setOverwriteFilled(event.target.checked)}
              />
              <span className="text-[var(--theme-text-default)]">
                Перезаписывать уже заполненные условия и ответы
                <span className="block text-xs" style={{ color: "var(--theme-danger-text)" }}>
                  Ручные правки этих номеров ({preview.willOverwrite} шт.) будут потеряны.
                </span>
              </span>
            </label>
          ) : null}

          {preview.issues.length > 0 ? (
            <div className="space-y-1">
              <div className="ui-form-label">Отбраковано при проверке</div>
              <ul
                className="list-disc space-y-1 pl-5 text-xs leading-5"
                style={{ color: "var(--theme-danger-text)" }}
              >
                {preview.issues.map((issue, index) => (
                  <li key={`issue-${index}`}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="space-y-1">
              <div className="ui-form-label">Предупреждения от модели</div>
              <ul className="ui-hint list-disc space-y-1 pl-5">
                {preview.warnings.map((warning, index) => (
                  <li key={`warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.sample.length > 0 ? (
            <div className="space-y-2.5">
              <div className="ui-form-label">Как это увидит ученик</div>
              {preview.sample.map((item) => (
                <div key={`sample-${item.number}`} className="ui-card-soft rounded-[14px] px-3.5 py-3">
                  <div className="ui-kicker">Номер {item.number}</div>
                  <div className="mt-1.5">
                    <LatexAnswerPreview value={item.conditionLatex} />
                  </div>
                  {item.answerLatex ? (
                    <div className="mt-2 space-y-1 border-t border-[var(--theme-border-soft)] pt-2">
                      <div className="ui-kicker">Ответ</div>
                      <LatexAnswerPreview value={item.answerLatex} />
                    </div>
                  ) : (
                    <div className="ui-hint mt-2">
                      Ответа нет — автопроверка отправит номер на ручную проверку.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" className={BUTTON_PRIMARY} disabled={pending} onClick={() => void send("apply")}>
              {pending ? "Импортируем…" : "Импортировать"}
            </button>
            <button type="button" className={BUTTON_SECONDARY} disabled={pending} onClick={() => setPreview(null)}>
              Отменить
            </button>
          </div>
        </div>
      ) : null}

      {applied ? (
        <div className="space-y-2 ui-fade-slide">
          <div className="ui-notice-success">
            Готово: добавлено {applied.created}, заполнено {applied.filled}, перезаписано {applied.overwritten}
            {applied.skipped > 0 ? `, пропущено заполненных ${applied.skipped}` : ""}.
          </div>
          <p className="ui-hint">
            Запустите «Разметить сложность номеров» в панели разработчика — без неё ИИ-подбор не знает, сколько
            времени занимают новые задачи.
          </p>
        </div>
      ) : null}
    </div>
  );
}
