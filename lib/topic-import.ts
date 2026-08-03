import { normalizeMultilineText, normalizeSingleLineText } from "@/lib/utils";

/*
 * Разбор файла импорта темы: JSON, который выдаёт внешний ИИ по промпту из
 * lib/topic-import-prompt.ts. Чистая логика без Prisma и сети — вся валидация
 * живёт здесь, чтобы её можно было покрыть тестами.
 *
 * Файлу не доверяем: структура проверяется поэлементно, кривые записи
 * отбрасываются в issues и показываются пользователю до записи в базу.
 */

export const IMPORT_FORMAT_VERSION = 1;
export const MAX_IMPORT_NUMBERS = 300;
export const MAX_IMPORT_TITLE_LENGTH = 200;
export const MAX_IMPORT_DESCRIPTION_LENGTH = 1000;
export const MAX_IMPORT_CONDITION_LENGTH = 4000;
export const MAX_IMPORT_ANSWER_LENGTH = 2000;
export const MAX_IMPORT_WARNINGS = 50;
export const MAX_IMPORT_WARNING_LENGTH = 300;
export const MIN_IMPORT_NUMBER = 1;
export const MAX_IMPORT_NUMBER = 999_999;

export type ImportNumber = {
  number: number;
  conditionLatex: string;
  answerLatex: string | null;
};

export type ParsedImport = {
  title: string;
  /** Может быть пустым: нужен только при создании новой темы. */
  description: string;
  numbers: ImportNumber[];
  /** Предупреждения самого ИИ — показываем как есть. */
  warnings: string[];
  /** Что отбраковали мы сами при разборе файла. */
  issues: string[];
};

/**
 * Удваивает одиночные обратные слэши. Модели сплошь и рядом отдают LaTeX как есть
 * (`$\dfrac{1}{2}$` вместо `$\\dfrac{1}{2}$`), и такой JSON не парсится вовсе
 * либо тихо превращает `\theta` в табуляцию. Экранирование кавычек и `\/`
 * не трогаем — там обратный слэш стоит по делу.
 */
export function repairJsonBackslashes(raw: string): string {
  return raw.replace(/\\([\s\S])/g, (match, next: string) =>
    next === "\\" || next === '"' || next === "/" ? match : `\\\\${next}`
  );
}

/**
 * Есть ли в разобранном объекте управляющие символы — след неэкранированного LaTeX
 * (`\text` превращается в табуляцию, `\frac` — в перевод страницы, `\right` — в возврат
 * каретки). Перевод строки не считаем подозрительным: он в условиях бывает по делу.
 */
function containsControlChars(value: unknown): boolean {
  if (typeof value === "string") {
    return /[\u0000-\u0009\u000B-\u001F]/.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(containsControlChars);
  }

  if (value && typeof value === "object") {
    return Object.values(value).some(containsControlChars);
  }

  return false;
}

/**
 * Разбирает текст файла в объект, вытаскивая его из markdown-обёртки и починив
 * экранирование, если модель его не сделала.
 */
export function parseImportJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  if (!text) {
    return { ok: false, error: "Файл пустой." };
  }

  let direct: unknown = null;
  let directOk = false;

  try {
    direct = JSON.parse(text);
    directOk = true;
  } catch {
    directOk = false;
  }

  if (directOk && !containsControlChars(direct)) {
    return { ok: true, value: direct };
  }

  try {
    return { ok: true, value: JSON.parse(repairJsonBackslashes(text)) };
  } catch {
    if (directOk) {
      return { ok: true, value: direct };
    }

    return {
      ok: false,
      error:
        "Файл не разбирается как JSON. Чаще всего модель не удвоила обратные слэши в формулах — попросите её прислать файл заново, строго по промпту."
    };
  }
}

export type TopicImportParseResult = { ok: true; data: ParsedImport } | { ok: false; error: string };

function toFiniteInteger(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Разбирает и нормализует файл импорта. Грубые поломки → ok: false, мелочь → issues. */
export function parseTopicImport(raw: unknown): TopicImportParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Файл должен быть JSON-объектом. Проверьте, что скопирован весь ответ модели." };
  }

  const record = raw as Record<string, unknown>;
  const version = toFiniteInteger(record.formatVersion);

  if (version !== IMPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: `Не та версия формата: ожидается formatVersion ${IMPORT_FORMAT_VERSION}. Возьмите свежий промпт со страницы импорта.`
    };
  }

  const topicRaw = record.topic;

  if (!topicRaw || typeof topicRaw !== "object" || Array.isArray(topicRaw)) {
    return { ok: false, error: "В файле нет блока topic с названием темы." };
  }

  const topic = topicRaw as Record<string, unknown>;
  const title = normalizeSingleLineText(readString(topic.title)).slice(0, MAX_IMPORT_TITLE_LENGTH);

  if (!title) {
    return { ok: false, error: "В файле пустое название темы (topic.title)." };
  }

  const description = normalizeMultilineText(readString(topic.description)).slice(
    0,
    MAX_IMPORT_DESCRIPTION_LENGTH
  );

  if (!Array.isArray(record.numbers)) {
    return { ok: false, error: "В файле нет списка задач (numbers)." };
  }

  const issues: string[] = [];
  const seen = new Set<number>();
  const numbers: ImportNumber[] = [];

  for (const entry of record.numbers) {
    if (numbers.length >= MAX_IMPORT_NUMBERS) {
      issues.push(
        `За один импорт берём не больше ${MAX_IMPORT_NUMBERS} задач — остальные пропущены. Разбейте файл на части.`
      );
      break;
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push("Пропущена запись: это не объект задачи.");
      continue;
    }

    const item = entry as Record<string, unknown>;
    const number = toFiniteInteger(item.number);

    if (number === null || number < MIN_IMPORT_NUMBER || number > MAX_IMPORT_NUMBER) {
      issues.push(`Пропущена запись с неверным номером: ${JSON.stringify(item.number ?? null)}.`);
      continue;
    }

    if (seen.has(number)) {
      issues.push(`Номер ${number} встречается несколько раз — взят первый.`);
      continue;
    }

    const conditionLatex = normalizeMultilineText(readString(item.conditionLatex)).slice(
      0,
      MAX_IMPORT_CONDITION_LENGTH
    );

    if (!conditionLatex) {
      issues.push(`Номер ${number} пропущен: пустое условие.`);
      continue;
    }

    const answerRaw = normalizeMultilineText(readString(item.answerLatex)).slice(0, MAX_IMPORT_ANSWER_LENGTH);

    seen.add(number);
    numbers.push({ number, conditionLatex, answerLatex: answerRaw || null });
  }

  if (numbers.length === 0) {
    return { ok: false, error: "В файле нет ни одной задачи, которую удалось бы разобрать." };
  }

  numbers.sort((a, b) => a.number - b.number);

  const warnings = Array.isArray(record.warnings)
    ? record.warnings
        .map((value) => normalizeSingleLineText(readString(value)).slice(0, MAX_IMPORT_WARNING_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_IMPORT_WARNINGS)
    : [];

  return { ok: true, data: { title, description, numbers, warnings, issues } };
}

export type ExistingNumber = {
  number: number;
  conditionLatex: string | null;
  answerLatex: string | null;
};

export type ImportPlan = {
  /** Номеров, которых в теме ещё нет. */
  toCreate: ImportNumber[];
  /** Номер есть, но соответствующее поле пустое — заполняем всегда. */
  toFill: ImportNumber[];
  /** Номер есть, поле заполнено и отличается — только при overwriteFilled. */
  toOverwrite: ImportNumber[];
  /** Всё уже совпадает — не трогаем. */
  untouched: number;
};

/**
 * Сопоставляет файл с текущим состоянием темы. Ничего не пишет — результат
 * показывается в предпросмотре, чтобы было видно, сколько ручной работы затрётся.
 */
export function buildImportPlan(parsed: ImportNumber[], existing: ExistingNumber[]): ImportPlan {
  const existingByNumber = new Map(existing.map((row) => [row.number, row]));

  const plan: ImportPlan = { toCreate: [], toFill: [], toOverwrite: [], untouched: 0 };

  for (const item of parsed) {
    const current = existingByNumber.get(item.number);

    if (!current) {
      plan.toCreate.push(item);
      continue;
    }

    const conditionFilled = Boolean(current.conditionLatex?.trim());
    const answerFilled = Boolean(current.answerLatex?.trim());

    const conditionDiffers = current.conditionLatex?.trim() !== item.conditionLatex;
    const answerDiffers = (current.answerLatex?.trim() || null) !== item.answerLatex;

    // Перезапись — только когда заполненное поле реально отличается от файла.
    const needsOverwrite =
      (conditionFilled && conditionDiffers) || (answerFilled && item.answerLatex !== null && answerDiffers);
    const needsFill = (!conditionFilled && conditionDiffers) || (!answerFilled && item.answerLatex !== null);

    if (needsOverwrite) {
      plan.toOverwrite.push(item);
      continue;
    }

    if (needsFill) {
      plan.toFill.push(item);
      continue;
    }

    plan.untouched += 1;
  }

  return plan;
}

/** Разбирает содержимое файла целиком: JSON (с починкой экранирования) → валидация. */
export function parseTopicImportText(raw: string): TopicImportParseResult {
  const json = parseImportJson(raw);

  if (!json.ok) {
    return { ok: false, error: json.error };
  }

  return parseTopicImport(json.value);
}
