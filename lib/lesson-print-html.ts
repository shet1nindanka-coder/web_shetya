import katex from "katex";
import { MATH_LINE_BREAKS_INLINE_SCRIPT } from "@/lib/math-line-breaks";
import { mergeSoftWrappedLines, splitLineIntoItems, splitMathIntoItems } from "@/lib/latex-line-items";
import { KATEX_CSS_MARKER } from "@/lib/print-theme";

/*
 * HTML-раздатка урока в единой печатной системе ШБЗ: шапка с плашкой и типом
 * документа, лента ученика, задачи с номерными бейджами. Формулы — KaTeX в
 * HTML-режиме (LaTeX-качество); CSS и шрифты KaTeX инлайнятся роутом через
 * embedKatexAssets (маркер в <head>), сама функция остаётся чистой.
 */

export type LessonPrintItem = {
  number: string;
  topicTitle: string;
  conditionLatex: string | null;
  /** Эталонный ответ — используется только листом «Ответы». */
  answerLatex?: string | null;
  isExtra?: boolean;
};

export type LessonPrintParticipant = {
  studentName: string;
  items: LessonPrintItem[];
};

export type LessonPrintData = {
  title: string;
  createdAt: Date | string;
  groupName: string | null;
  durationMinutes?: number | null;
  /** LESSON — раздатка урока, HOMEWORK — план ИИ-ДЗ (у него есть только «Ответы»). */
  kind?: "LESSON" | "HOMEWORK";
  participants: LessonPrintParticipant[];
};

export function escapeHtml(source: string): string {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ConditionSegment = { type: "text" | "inline" | "display"; value: string };

/** Разбивает условие на текст и формулы: $$…$$ и \[…\] — display, $…$ — inline. */
export function splitConditionSegments(source: string): ConditionSegment[] {
  const segments: ConditionSegment[] = [];
  let buffer = "";
  let i = 0;

  const flushText = () => {
    if (buffer) {
      segments.push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  while (i < source.length) {
    if (source.startsWith("$$", i)) {
      const end = source.indexOf("$$", i + 2);

      if (end !== -1) {
        flushText();
        segments.push({ type: "display", value: source.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (source.startsWith("\\[", i)) {
      const end = source.indexOf("\\]", i + 2);

      if (end !== -1) {
        flushText();
        segments.push({ type: "display", value: source.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }

    if (source[i] === "$" && !source.startsWith("$$", i)) {
      const end = source.indexOf("$", i + 1);

      if (end !== -1) {
        flushText();
        segments.push({ type: "inline", value: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    buffer += source[i];
    i += 1;
  }

  flushText();

  return segments;
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    // HTML-режим KaTeX с его шрифтами: книжное качество формул в любом PDF.
    return katex.renderToString(tex, { output: "html", throwOnError: false, displayMode });
  } catch {
    return `<span class="math-error">${escapeHtml(tex)}</span>`;
  }
}

/** Текст экранируется обязательно: conditionLatex вводит пользователь. */
export function renderConditionHtml(condition: string): string {
  return splitConditionSegments(condition)
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtml(segment.value).replace(/\n/g, "<br/>");
      }

      if (segment.type === "display") {
        const mathItems = splitMathIntoItems(segment.value);

        // Пункты «А) … Б) …» внутри display-формулы: каждый — отдельный
        // неразрывный блок, переносится целиком.
        if (mathItems.labeled && mathItems.items.length > 1) {
          const rendered = mathItems.items
            .map((item) => `<span class="math-item">${renderMath(`\\displaystyle ${item}`, false)}</span>`)
            .join("");

          return `<span class="math-items">${rendered}</span>`;
        }

        return `<span class="math-display">${renderMath(segment.value, true)}</span>`;
      }

      return renderMath(segment.value, false);
    })
    .join("");
}

/**
 * Условие с раскладкой пунктов по сетке. Если display-математики нет, каждая
 * строка проверяется на метки «а) … б) …»: пункты становятся ячейками сетки и
 * переносятся целиком. Условия с $$…$$ рендерятся классическим потоком —
 * там сетку строит .math-items внутри самой формулы.
 */
export function renderConditionGridHtml(source: string): string {
  // Как и на сайте: типографские переносы из задачника склеиваются в абзацы.
  const condition = mergeSoftWrappedLines(source);

  if (condition.includes("$$") || condition.includes("\\[")) {
    return `<div class="cond-line">${renderConditionHtml(condition)}</div>`;
  }

  return condition
    .split("\n")
    .map((line) => {
      if (!line.trim()) {
        return "";
      }

      const split = splitLineIntoItems(line);

      if (split.labeled && split.items.length > 1) {
        const cells = split.items
          .map((item) => `<span class="item-cell">${renderConditionHtml(item)}</span>`)
          .join("");

        return `<div class="items-grid">${cells}</div>`;
      }

      return `<div class="cond-line">${renderConditionHtml(line)}</div>`;
    })
    .join("");
}

function formatPrintDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pluralTasks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} задача`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} задачи`;
  return `${count} задач`;
}

type DocMeta = {
  dateLabel: string;
  metaParts: string[];
};

function buildDocMeta(lesson: LessonPrintData): DocMeta {
  return {
    dateLabel: formatPrintDate(lesson.createdAt),
    // Минуты в печать не идут: время — внутренняя оценка ИИ, ученику оно не нужно.
    metaParts: [
      escapeHtml(lesson.title),
      lesson.groupName ? escapeHtml(lesson.groupName) : null
    ].filter((part): part is string => Boolean(part))
  };
}

function buildHeadRow(docLabel: string, rightHtml: string): string {
  return `<div class="doc-head-line">
  <div class="doc-brand"><span class="logo">ШБЗ<span class="logo__sub">Школа</span></span> · ${docLabel}</div>
  <div class="doc-meta">${rightHtml}</div>
</div>`;
}

const PRINT_CSS = `
  @page { size: A4; margin: 15mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Montserrat", -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #2c2e33;
  }
  .doc-head-line {
    display: flex; justify-content: space-between; align-items: baseline; gap: 12pt;
    border-bottom: 1.8pt solid #0a0a0a; padding-bottom: 6pt;
  }
  .doc-brand { font-size: 11pt; font-weight: 800; color: #0a0a0a; letter-spacing: -0.2px; white-space: nowrap; }
  /* Лок «ШБЗШкола», мелкая/печатная версия: приписка в --brand-deep. */
  .doc-brand .logo { font-family: "Montserrat", Helvetica, Arial, sans-serif; font-weight: 900; font-size: 12pt; letter-spacing: -0.015em; color: #0a0a0a; }
  .doc-brand .logo__sub { color: #0e9b80; }
  .doc-meta { font-size: 8pt; color: #6a6e75; text-align: right; }
  .doc-meta b { color: #0a0a0a; font-weight: 700; }
  .task { padding: 10pt 0 9pt; border-bottom: 0.75pt solid #ececee; break-inside: avoid; }
  .task:last-of-type { border-bottom: none; }
  .task-kicker {
    display: flex; justify-content: space-between; align-items: baseline; gap: 8pt;
    font-size: 7.5pt; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase;
    color: #9aa0a6; margin-bottom: 5pt;
  }
  .task-kicker b { color: #0a0a0a; }
  .cond-line { font-size: 11pt; line-height: 1.65; }
  .items-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(112pt, 1fr));
    gap: 7pt 16pt; margin-top: 3pt;
  }
  .item-cell { break-inside: avoid; font-size: 11pt; line-height: 1.5; }
  .math-items {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(112pt, 1fr));
    gap: 7pt 16pt; max-width: 100%;
  }
  .math-items > .math-item { display: inline-block; max-width: 100%; }
  .math-display { display: block; margin: 4pt 0; }
  .math-display .katex-display { margin: 0; text-align: left; }
  .math-display .katex-display > .katex { text-align: left; }
  /* Перенос длинных формул между верхнеуровневыми сегментами; знак повторяется
     в начале новой строки инлайн-скриптом (lib/math-line-breaks.ts). */
  .katex { white-space: normal; }
  .katex .base { white-space: nowrap; }
  .katex-display > .katex { white-space: normal; }
  .empty { font-style: italic; color: #6a6e75; }
  .extra-divider {
    display: flex; align-items: center; gap: 8pt; margin: 12pt 0 2pt;
    font-size: 8pt; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #1b9e63;
  }
  .extra-divider::before, .extra-divider::after { content: ""; height: 0.75pt; background: #c7cad0; flex: 1; }
  .ans-row {
    display: flex; gap: 12pt; align-items: baseline;
    padding: 6pt 0; border-bottom: 0.75pt solid #ececee; break-inside: avoid;
  }
  .ans-row:last-of-type { border-bottom: none; }
  .ans-ref {
    width: 118pt; flex-shrink: 0;
    font-size: 7.5pt; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6a6e75;
  }
  .ans-ref b { color: #0a0a0a; }
  .ans-ref .ans-extra { color: #1b9e63; }
  .ans-val { min-width: 0; flex: 1; font-size: 10.5pt; line-height: 1.55; }
  .ans-missing { color: #9aa0a6; font-style: italic; }
  .math-error { color: #c23d4b; }
`;

function buildPrintDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
${KATEX_CSS_MARKER}
<style>${PRINT_CSS}</style>
</head>
<body>
${body}
<script>
${MATH_LINE_BREAKS_INLINE_SCRIPT}
(function () {
  var run = function () { try { window.__applyMathBreaks(document); } catch (e) {} };
  run();
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
})();
</script>
</body>
</html>`;
}

export function renderLessonPrintHtml(lesson: LessonPrintData): string {
  const { dateLabel, metaParts } = buildDocMeta(lesson);

  const sections = lesson.participants
    .map((participant, participantIndex) => {
      const renderTask = (item: LessonPrintItem, index: number, extra: boolean) => {
        const conditionHtml = item.conditionLatex
          ? renderConditionGridHtml(item.conditionLatex)
          : `<div class="cond-line"><em>см. файл ДЗ по теме «${escapeHtml(item.topicTitle)}», № ${item.number}</em></div>`;

        return `<div class="task">
  <div class="task-kicker"><span><b>Задача ${index + 1}</b> · № ${item.number}${extra ? " · доп." : ""}</span></div>
  ${conditionHtml}
</div>`;
      };

      const mainItems = participant.items.filter((item) => !item.isExtra);
      const extraItems = participant.items.filter((item) => item.isExtra);
      let tasks = mainItems.map((item, index) => renderTask(item, index, false)).join("\n");

      if (extraItems.length > 0) {
        tasks += `\n<div class="extra-divider"><span>Дополнительные задания — если основная часть решена</span></div>\n`;
        tasks += extraItems.map((item, index) => renderTask(item, mainItems.length + index, true)).join("\n");
      }

      const rightMeta = `<b>${escapeHtml(participant.studentName)}</b> · ${metaParts.join(" · ")}${dateLabel ? ` · ${dateLabel}` : ""} · ${pluralTasks(participant.items.length)}`;

      return `<section class="student"${participantIndex > 0 ? ' style="break-before: page;"' : ""}>
  ${buildHeadRow("Раздатка урока", rightMeta)}
  ${tasks || '<p class="empty">Задания не назначены.</p>'}
</section>`;
    })
    .join("\n");

  return buildPrintDocument(lesson.title, sections);
}

/**
 * Отдельный документ «Ответы»: только номера и эталонные ответы, без условий.
 * Печатается сам по себе — учитель не рискует раздать ответы вместе с задачами.
 * Работает и для урока, и для плана ИИ-ДЗ (kind HOMEWORK).
 */
export function renderLessonAnswersHtml(lesson: LessonPrintData): string {
  const { dateLabel, metaParts } = buildDocMeta(lesson);
  const docLabel = lesson.kind === "HOMEWORK" ? "Ответы к ДЗ" : "Ответы к занятию";

  const sections = lesson.participants
    .map((participant, participantIndex) => {
      const rows = participant.items
        .map((item) => {
          const answerHtml = item.answerLatex
            ? renderConditionGridHtml(item.answerLatex)
            : '<span class="ans-missing">ответ не заполнен</span>';

          return `<div class="ans-row">
  <div class="ans-ref"><b>№ ${item.number}</b>${item.isExtra ? ' · <span class="ans-extra">доп.</span>' : ""}</div>
  <div class="ans-val">${answerHtml}</div>
</div>`;
        })
        .join("\n");

      const rightMeta = `<b>${escapeHtml(participant.studentName)}</b> · ${metaParts.join(" · ")}${dateLabel ? ` · ${dateLabel}` : ""}`;

      return `<section class="student"${participantIndex > 0 ? ' style="break-before: page;"' : ""}>
  ${buildHeadRow(docLabel, rightMeta)}
  ${rows || '<p class="empty">Задания не назначены.</p>'}
</section>`;
    })
    .join("\n");

  return buildPrintDocument(`Ответы — ${lesson.title}`, sections);
}
