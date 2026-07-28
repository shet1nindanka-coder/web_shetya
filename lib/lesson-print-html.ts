import katex from "katex";

/*
 * HTML-раздатка урока: каждый ученик с новой страницы, формулы — KaTeX → MathML
 * (Chromium рендерит MathML нативно, шрифты KaTeX не нужны). Чистая функция,
 * покрыта тестами.
 */

export type LessonPrintItem = {
  number: number;
  topicTitle: string;
  conditionLatex: string | null;
};

export type LessonPrintParticipant = {
  studentName: string;
  items: LessonPrintItem[];
};

export type LessonPrintData = {
  title: string;
  createdAt: Date | string;
  groupName: string | null;
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
    // throwOnError: false отдаёт формулу красным текстом вместо падения страницы.
    return katex.renderToString(tex, { output: "mathml", throwOnError: false, displayMode });
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

      return renderMath(segment.value, segment.type === "display");
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

export function renderLessonPrintHtml(lesson: LessonPrintData): string {
  const dateLabel = formatPrintDate(lesson.createdAt);

  const sections = lesson.participants
    .map((participant, participantIndex) => {
      const tasks = participant.items
        .map((item, index) => {
          const conditionHtml = item.conditionLatex
            ? renderConditionHtml(item.conditionLatex)
            : `<em>см. файл ДЗ по теме «${escapeHtml(item.topicTitle)}», № ${item.number}</em>`;

          return `<div class="task">
  <div class="task-head">${index + 1}. № ${item.number} · ${escapeHtml(item.topicTitle)}</div>
  <div class="task-body">${conditionHtml}</div>
</div>`;
        })
        .join("\n");

      return `<section class="student"${participantIndex > 0 ? ' style="break-before: page;"' : ""}>
  <header class="student-head">
    <div class="student-name">${escapeHtml(participant.studentName)}</div>
    <div class="student-meta">${escapeHtml(lesson.title)}${lesson.groupName ? ` · ${escapeHtml(lesson.groupName)}` : ""}${dateLabel ? ` · ${dateLabel}` : ""}</div>
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
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Times New Roman", "PT Serif", serif;
    font-size: 12pt;
    line-height: 1.45;
    color: #000;
  }
  .student { padding-top: 2mm; }
  .student-head {
    border-bottom: 1.5pt solid #000;
    padding-bottom: 3mm;
    margin-bottom: 5mm;
  }
  .student-name { font-size: 15pt; font-weight: bold; }
  .student-meta { font-size: 10pt; margin-top: 1mm; }
  .task { margin-bottom: 5mm; break-inside: avoid; }
  .task-head { font-weight: bold; margin-bottom: 1.5mm; }
  .task-body { }
  .empty { font-style: italic; }
  .math-error { color: #b00020; }
</style>
</head>
<body>
${sections}
</body>
</html>`;
}
