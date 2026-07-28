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

export function splitLineIntoItems(line: string): LineItemsResult {
  const boundaries: number[] = [];
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

    if (ITEM_LABEL_PATTERN.test(line.slice(i, i + 5))) {
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
