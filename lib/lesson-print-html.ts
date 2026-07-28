import katex from "katex";
import { splitMathIntoItems } from "@/lib/latex-line-items";
import { KATEX_CSS_MARKER } from "@/lib/print-theme";

/*
 * HTML-раздатка урока в единой печатной системе ШБЗ: шапка с плашкой и типом
 * документа, лента ученика, задачи с номерными бейджами. Формулы — KaTeX в
 * HTML-режиме (LaTeX-качество); CSS и шрифты KaTeX инлайнятся роутом через
 * embedKatexAssets (маркер в <head>), сама функция остаётся чистой.
 */

export type LessonPrintItem = {
  number: number;
  topicTitle: string;
  conditionLatex: string | null;
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

export function renderLessonPrintHtml(lesson: LessonPrintData): string {
  const dateLabel = formatPrintDate(lesson.createdAt);
  const metaParts = [
    escapeHtml(lesson.title),
    lesson.groupName ? escapeHtml(lesson.groupName) : null,
    lesson.durationMinutes ? `${lesson.durationMinutes} минут` : null
  ].filter(Boolean);

  const sections = lesson.participants
    .map((participant, participantIndex) => {
      const renderTask = (item: LessonPrintItem, index: number, extra: boolean) => {
        const conditionHtml = item.conditionLatex
          ? renderConditionHtml(item.conditionLatex)
          : `<em>см. файл ДЗ по теме «${escapeHtml(item.topicTitle)}», № ${item.number}</em>`;

        return `<div class="task">
  <div class="task-num${extra ? " task-num--extra" : ""}">${index + 1}</div>
  <div class="task-body">
    <div class="task-ref">№ ${item.number} · <b>${escapeHtml(item.topicTitle)}</b></div>
    <div class="task-cond">${conditionHtml}</div>
  </div>
</div>`;
      };

      const mainItems = participant.items.filter((item) => !item.isExtra);
      const extraItems = participant.items.filter((item) => item.isExtra);
      let tasks = mainItems.map((item, index) => renderTask(item, index, false)).join("\n");

      if (extraItems.length > 0) {
        tasks += `\n<div class="extra-divider"><span>Дополнительные задания ⭐ — если основная часть решена</span></div>\n`;
        tasks += extraItems.map((item, index) => renderTask(item, mainItems.length + index, true)).join("\n");
      }

      return `<section class="student"${participantIndex > 0 ? ' style="break-before: page;"' : ""}>
  <div class="doc-head">
    <div class="brand">
      <div class="brand-badge">ШБЗ</div>
      <div><div class="brand-name">ШБЗ</div><div class="brand-sub">Школа Базовых Знаний</div></div>
    </div>
    <div class="doc-kind">
      <div class="kicker">Раздатка урока</div>
      <div class="gen">${metaParts.join(" · ")}${dateLabel ? ` · ${dateLabel}` : ""}</div>
    </div>
  </div>
  <hr class="head-rule"/>
  <header class="subject-band">
    <div class="subject-name">${escapeHtml(participant.studentName)}</div>
    <div class="subject-meta">${pluralTasks(participant.items.length)} · порядок решения — сверху вниз</div>
  </header>
  ${tasks || '<p class="empty">Задания не назначены.</p>'}
</section>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(lesson.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700;800&display=swap" rel="stylesheet"/>
${KATEX_CSS_MARKER}
<style>
  @page { size: A4; margin: 15mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Onest", -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #2c2e33;
  }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { display: flex; align-items: center; gap: 8px; }
  .brand-badge {
    width: 30px; height: 30px; border-radius: 7px; background: #0a0a0a; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 10.5pt; letter-spacing: 0.3px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .brand-name { font-size: 10pt; font-weight: 800; color: #0a0a0a; line-height: 1.2; }
  .brand-sub { font-size: 7.5pt; color: #6a6e75; }
  .doc-kind { text-align: right; }
  .kicker { font-size: 8.5pt; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase; color: #0a0a0a; }
  .kicker::after {
    content: ""; display: block; height: 2.5pt; width: 34px; background: #16b07e;
    margin: 4px 0 0 auto; border-radius: 2px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .gen { font-size: 7.5pt; color: #6a6e75; margin-top: 4px; }
  .head-rule { border: none; border-top: 1.6pt solid #0a0a0a; margin: 10pt 0 0; }
  .subject-band {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 9pt 0 8pt; border-bottom: 0.75pt solid #e5e7eb; margin-bottom: 2pt;
  }
  .subject-name { font-size: 16pt; font-weight: 800; color: #0a0a0a; letter-spacing: -0.2px; }
  .subject-meta { font-size: 8pt; color: #6a6e75; }
  .task {
    display: flex; gap: 10pt; padding: 10pt 0 9pt;
    border-bottom: 0.75pt solid #e5e7eb; break-inside: avoid;
  }
  .task:last-of-type { border-bottom: none; }
  .task-num {
    width: 19pt; height: 19pt; border: 1.2pt solid #0a0a0a; border-radius: 5pt;
    display: flex; align-items: center; justify-content: center;
    font-size: 9.5pt; font-weight: 800; color: #0a0a0a; flex-shrink: 0; margin-top: 1pt;
  }
  .task-body { min-width: 0; flex: 1; }
  .task-ref {
    font-size: 7.5pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    color: #6a6e75; margin-bottom: 4pt;
  }
  .task-ref b { color: #0a0a0a; }
  .task-cond { font-size: 11pt; line-height: 1.7; }
  .math-items { display: inline-flex; flex-wrap: wrap; gap: 6pt 22pt; align-items: center; max-width: 100%; }
  .math-items > .math-item { display: inline-block; max-width: 100%; }
  .math-display { display: block; margin: 4pt 0; }
  .math-display .katex-display { margin: 0; text-align: left; }
  .math-display .katex-display > .katex { text-align: left; }
  .empty { font-style: italic; color: #6a6e75; }
  .task-num--extra { border-style: dashed; color: #6a6e75; border-color: #6a6e75; }
  .extra-divider {
    display: flex; align-items: center; gap: 8pt; margin: 12pt 0 2pt;
    font-size: 8pt; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #6a6e75;
  }
  .extra-divider::before, .extra-divider::after { content: ""; height: 0.75pt; background: #c7cad0; flex: 1; }
  .math-error { color: #c23d4b; }
</style>
</head>
<body>
${sections}
</body>
</html>`;
}
