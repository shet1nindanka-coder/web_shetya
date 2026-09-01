/*
 * Разбиение строки условия на пункты по меткам «а)», «Б)», «1)», «2.» вне формул.
 * Каждый пункт рендерится неразрывным inline-block: целиком переносится на новую
 * строку, а внутри себя (max-w-full) переносится по словам — карточку не растягивает.
 */

export type LineItemsResult = {
  items: string[];
  labeled: boolean;
};

// Метка пункта: одна буква (обе раскладки, оба регистра) или число 1–99,
// затем «)» либо «.» — точка только перед пробелом/концом, чтобы не ловить «1.5».
const ITEM_LABEL_PATTERN = /^(?:[А-ЯЁа-яёA-Za-z]|\d{1,2})(?:\)|\.(?=\s|$))/;
// Скобочная форма метки — «а)», «10)»: однозначна и распознаётся в любом месте строки.
const PAREN_LABEL_PATTERN = /^(?:[А-ЯЁа-яёA-Za-z]|\d{1,2})\)/;
// Точечная форма — «а.», «10.»: в прозе совпадает с концом предложения («…получится 10.»)
// и сокращениями («и т. д.»), поэтому в середине строки признаётся меткой только когда
// сама строка начинается с точечной метки (то есть это явное перечисление «1. … 2. …»).
const DOT_LABEL_PATTERN = /^(?:[А-ЯЁа-яёA-Za-z]|\d{1,2})\.(?=\s|$)/;
// Метка внутри \text{…}: «\text{А)}», «\text{ 1) }» и т.п.
const TEXT_LABEL_PATTERN = /^\\text\{\s*(?:[А-ЯЁа-яёA-Za-z]|\d{1,2})(?:\)|\.)/;

export function splitLineIntoItems(line: string): LineItemsResult {
  const boundaries: number[] = [];
  const startsWithDotLabel = DOT_LABEL_PATTERN.test(line);
  let inMath = false;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === "$") {
      inMath = !inMath;
      continue;
    }

    // Метка внутри $…$ — не метка; метка не в начале слова — тоже.
    if (inMath || (i > 0 && !/\s/.test(line[i - 1]))) {
      continue;
    }

    const slice = line.slice(i, i + 5);

    if (PAREN_LABEL_PATTERN.test(slice) || ((i === 0 || startsWithDotLabel) && DOT_LABEL_PATTERN.test(slice))) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) {
    return { items: [line], labeled: false };
  }

  if (boundaries[0] !== 0) {
    boundaries.unshift(0);
  }

  const items: string[] = [];

  for (let b = 0; b < boundaries.length; b++) {
    const item = line.slice(boundaries[b], boundaries[b + 1] ?? line.length).trim();

    if (item) {
      items.push(item);
    }
  }

  return { items, labeled: true };
}

// Конец предложения (или заголовка-надписи «Решите:») — после него перенос строки
// считается осмысленным. Допускаются закрывающие кавычки/скобки после знака.
const SENTENCE_END_PATTERN = /[.!?…:;]["»')\]]*$/;

/*
 * Склейка «мягких» переносов строк в прозе условия. Задачники приходят из PDF
 * с типографскими переносами посреди предложения (и даже с пустой строкой между
 * половинами фразы) — без склейки каждая строка рендерится отдельным абзацем.
 * Перенос сохраняется, только если предыдущая строка закончила предложение
 * (SENTENCE_END_PATTERN) либо граничит с display-формулой ($$…$$ или \[…\]);
 * иначе он заменяется пробелом. Внутренность display-формул не трогается.
 */
export function mergeSoftWrappedLines(source: string): string {
  const stash: string[] = [];
  const shielded = source.replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/g, (match) => {
    stash.push(match);
    return `\u0000${stash.length - 1}\u0000`;
  });

  const merged = shielded.replace(/[ \t]*\n[\s]*/g, (lineBreak, offset: number) => {
    const before = shielded.slice(0, offset);
    const prevLine = before.slice(before.lastIndexOf("\n") + 1).trimEnd();
    const nextChar = shielded[offset + lineBreak.length] ?? "";

    if (!prevLine || SENTENCE_END_PATTERN.test(prevLine) || prevLine.endsWith("\u0000") || nextChar === "\u0000") {
      return lineBreak;
    }

    return " ";
  });

  return merged.replace(/\u0000(\d+)\u0000/g, (_, index: string) => stash[Number(index)] ?? "");
}

/*
 * Разбиение содержимого display-формулы ($$…$$) на пункты по тем же меткам,
 * но только на верхнем уровне: не внутри групп {…} и не внутри окружений
 * \begin{…}…\end{…} (системы уравнений, матрицы). Каждый пункт рендерится
 * отдельной формулой и переносится на новую строку целиком.
 */
export function splitMathIntoItems(math: string): LineItemsResult {
  const boundaries: number[] = [];
  let braceDepth = 0;
  let envDepth = 0;

  for (let i = 0; i < math.length; i++) {
    const char = math[i];
    const escaped = i > 0 && math[i - 1] === "\\";

    if (char === "{" && !escaped) {
      braceDepth += 1;
      continue;
    }

    if (char === "}" && !escaped) {
      braceDepth = Math.max(0, braceDepth - 1);
      continue;
    }

    if (char === "\\") {
      if (math.startsWith("\\begin{", i)) {
        envDepth += 1;
      } else if (math.startsWith("\\end{", i)) {
        envDepth = Math.max(0, envDepth - 1);
      } else if (
        braceDepth === 0 &&
        envDepth === 0 &&
        (i === 0 || /\s/.test(math[i - 1])) &&
        TEXT_LABEL_PATTERN.test(math.slice(i, i + 14))
      ) {
        // Метка, завёрнутая в \text{А)} на верхнем уровне — тоже граница пункта.
        boundaries.push(i);
      }

      continue;
    }

    if (braceDepth > 0 || envDepth > 0) {
      continue;
    }

    if (i > 0 && !/\s/.test(math[i - 1])) {
      continue;
    }

    if (ITEM_LABEL_PATTERN.test(math.slice(i, i + 5))) {
      boundaries.push(i);
    }
  }

  if (boundaries.length === 0) {
    return { items: [math], labeled: false };
  }

  if (boundaries[0] !== 0) {
    boundaries.unshift(0);
  }

  const items: string[] = [];

  for (let b = 0; b < boundaries.length; b++) {
    const item = math.slice(boundaries[b], boundaries[b + 1] ?? math.length).trim();

    if (item) {
      items.push(item);
    }
  }

  return { items, labeled: true };
}
