"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LatexAnswerPreview } from "@/components/latex-answer-preview";
import { ShbzSelect } from "@/components/shbz-select";
import { TOPIC_IMPORT_PROMPT } from "@/lib/topic-import-prompt";

type TopicOption = { id: string; title: string };

type PreviewNumber = {
  number: number;
  conditionLatex: string;
  answerLatex: string | null;
};

type PreviewResponse = {
  title: string;
  description: string;
  targetTitle: string | null;
  willCreateTopic: boolean;
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
  topicId: string;
  created: number;
  filled: number;
  overwritten: number;
  skipped: number;
};

type TopicImportPanelProps = {
  topics: TopicOption[];
};

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: "danger" | "muted" }) {
  const valueColor =
    tone === "danger"
      ? "var(--shbz-danger-text)"
      : tone === "muted"
        ? "var(--shbz-text-muted)"
        : "var(--shbz-text-strong)";

  return (
    <div
      className="rounded-[14px] border px-4 py-3"
      style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      <div className="mt-1 text-[19px] font-extrabold" style={{ color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

export function TopicImportPanel({ topics }: TopicImportPanelProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [targetKind, setTargetKind] = useState<"existing" | "new">(topics.length > 0 ? "existing" : "new");
  const [topicId, setTopicId] = useState(topics[0]?.id ?? "");
  const [rawJson, setRawJson] = useState("");
  const [overwriteFilled, setOverwriteFilled] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const target = targetKind === "new" ? { kind: "new" as const } : { kind: "existing" as const, topicId };

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(TOPIC_IMPORT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Браузер не дал доступ к буферу обмена — скопируйте текст вручную.");
    }
  }

  async function readFile(file: File) {
    setError(null);
    setPreview(null);
    setApplied(null);

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
        body: JSON.stringify({ mode, payload, target, overwriteFilled })
      });

      const data = (await response.json().catch(() => null)) as
        | (PreviewResponse & ApplyResponse & { error?: string })
        | null;

      if (!response.ok) {
        setError(data?.error ?? "Импорт не удался. Попробуйте ещё раз.");
        return;
      }

      if (mode === "preview") {
        setPreview(data as unknown as PreviewResponse);
        setApplied(null);
      } else {
        setApplied(data as unknown as ApplyResponse);
        setPreview(null);
        setRawJson("");

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        router.refresh();
      }
    } catch {
      setError("Сервер не ответил. Проверьте соединение и попробуйте снова.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <button type="button" className="shbz-btn-outline" onClick={() => setPromptOpen((open) => !open)}>
          {promptOpen ? "Скрыть промпт" : "Показать промпт для ИИ"}
        </button>

        {promptOpen ? (
          <div className="mt-3 space-y-3 ui-fade-slide">
            <p className="text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
              Откройте любой чат с ИИ, который умеет читать файлы, приложите задачник и отправьте этот промпт.
              Ответ модели сохраните как файл <code>.json</code> или вставьте текстом ниже.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="shbz-btn-primary" onClick={copyPrompt}>
                Скопировать промпт
              </button>
              {copied ? (
                <span className="text-sm font-semibold" style={{ color: "var(--shbz-green-text)" }}>
                  Скопировано
                </span>
              ) : null}
            </div>
            <pre
              className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[14px] border px-4 py-3 text-xs leading-5"
              style={{
                background: "var(--shbz-soft-bg)",
                borderColor: "var(--shbz-soft-border)",
                color: "var(--shbz-text-muted)"
              }}
            >
              {TOPIC_IMPORT_PROMPT}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Куда импортировать
          </span>
          <ShbzSelect
            value={targetKind}
            onChange={(value) => {
              setTargetKind(value === "new" ? "new" : "existing");
              setPreview(null);
              setApplied(null);
            }}
            options={[
              { value: "existing", label: "В существующую тему" },
              { value: "new", label: "Создать новую тему" }
            ]}
            ariaLabel="Куда импортировать"
          />
        </label>

        {targetKind === "existing" ? (
          <label className="block">
            <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
              Тема
            </span>
            <ShbzSelect
              value={topicId}
              onChange={(value) => {
                setTopicId(value);
                setPreview(null);
                setApplied(null);
              }}
              options={topics.map((topic) => ({ value: topic.id, label: topic.title }))}
              placeholder="Выберите тему"
              ariaLabel="Тема для импорта"
            />
          </label>
        ) : (
          <div
            className="rounded-[14px] border px-4 py-3 text-xs leading-5"
            style={{
              background: "var(--shbz-soft-bg)",
              borderColor: "var(--shbz-soft-border)",
              color: "var(--shbz-text-muted)"
            }}
          >
            Название и описание темы возьмутся из файла. Файлы теории и домашней работы приложите потом на
            странице темы — импорт их не переносит.
          </div>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            Файл импорта
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,.txt"
            className="shbz-input"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void readFile(file);
              }
            }}
          />
        </label>

        <label className="block">
          <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
            …или вставьте JSON текстом
          </span>
          <textarea
            className="shbz-textarea"
            rows={6}
            value={rawJson}
            placeholder='{"formatVersion": 1, "topic": {...}, "numbers": [...]}'
            onChange={(event) => {
              setRawJson(event.target.value);
              setPreview(null);
              setApplied(null);
            }}
          />
        </label>

        <button
          type="button"
          className="shbz-btn-primary"
          disabled={pending || !rawJson.trim() || (targetKind === "existing" && !topicId)}
          onClick={() => void send("preview")}
        >
          {pending ? "Проверяем…" : "Проверить файл"}
        </button>
      </div>

      {error ? <div className="shbz-notice-error">{error}</div> : null}

      {preview ? (
        <div className="space-y-4 ui-fade-slide">
          <div className="text-sm font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
            {preview.willCreateTopic
              ? `Будет создана тема «${preview.title}»`
              : `Импорт в тему «${preview.targetTitle ?? ""}»`}
            <span className="ml-2 font-normal" style={{ color: "var(--shbz-text-muted)" }}>
              задач в файле: {preview.totalInFile}
            </span>
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <SummaryTile label="Добавим" value={preview.willAddNumbers} />
            <SummaryTile label="Заполним пустых" value={preview.willFillEmpty} />
            <SummaryTile label="Перезапишем" value={preview.willOverwrite} tone="danger" />
            <SummaryTile label="Без изменений" value={preview.untouched} tone="muted" />
          </div>

          {preview.willOverwrite > 0 ? (
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="shbz-checkbox mt-0.5"
                checked={overwriteFilled}
                onChange={(event) => setOverwriteFilled(event.target.checked)}
              />
              <span style={{ color: "var(--shbz-text-default)" }}>
                Перезаписывать уже заполненные условия и ответы.
                <span className="block text-xs" style={{ color: "var(--shbz-danger-text)" }}>
                  Ручные правки этих {preview.willOverwrite} номеров будут потеряны.
                </span>
              </span>
            </label>
          ) : null}

          {preview.issues.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Отбраковано при проверке
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-5" style={{ color: "var(--shbz-danger-text)" }}>
                {preview.issues.map((issue, index) => (
                  <li key={`issue-${index}`}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.warnings.length > 0 ? (
            <div className="space-y-1">
              <div className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Предупреждения от модели
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs leading-5" style={{ color: "var(--shbz-text-muted)" }}>
                {preview.warnings.map((warning, index) => (
                  <li key={`warning-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.sample.length > 0 ? (
            <div className="space-y-3">
              <div className="text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
                Как это будет выглядеть у ученика
              </div>
              {preview.sample.map((item) => (
                <div
                  key={`sample-${item.number}`}
                  className="rounded-[14px] border px-4 py-3"
                  style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                    Номер {item.number}
                  </div>
                  <div className="mt-2">
                    <LatexAnswerPreview value={item.conditionLatex} />
                  </div>
                  {item.answerLatex ? (
                    <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--shbz-soft-border)" }}>
                      <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                        Ответ
                      </div>
                      <LatexAnswerPreview value={item.answerLatex} />
                    </div>
                  ) : (
                    <div className="mt-2 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                      Ответа нет — автопроверка отправит номер на ручную проверку.
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="shbz-btn-primary"
              disabled={pending}
              onClick={() => void send("apply")}
            >
              {pending ? "Импортируем…" : "Импортировать"}
            </button>
            <button type="button" className="shbz-btn-outline" disabled={pending} onClick={() => setPreview(null)}>
              Отменить
            </button>
          </div>
        </div>
      ) : null}

      {applied ? (
        <div className="space-y-2 ui-fade-slide">
          <div className="shbz-notice-success">
            Готово: добавлено {applied.created}, заполнено {applied.filled}, перезаписано {applied.overwritten}
            {applied.skipped > 0 ? `, пропущено заполненных ${applied.skipped}` : ""}.
          </div>
          <p className="text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
            Запустите «Разметить сложность номеров» в разделе «Действия» — без неё ИИ-подбор не знает, сколько
            времени занимают новые задачи.
          </p>
          <a className="shbz-btn-outline inline-flex" href={`/teacher/topics/${applied.topicId}`}>
            Открыть тему
          </a>
        </div>
      ) : null}
    </div>
  );
}
