import {
  compareHomeworkNumbers,
  normalizeHomeworkNumber,
  normalizeMultilineText,
  normalizeSingleLineText
} from "@/lib/utils";

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
// Номер — строка из цифр как в задачнике, ведущие нули значимы («010203»).
export const IMPORT_NUMBER_PATTERN = /^\d{1,12}$/;

export type ImportNumber = {
  number: string;
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
 * либо тихо превращает `\theta` в табуляцию.
 *
 * Не трогаем `\\`, `\"` и `\/` — там обратный слэш стоит по делу. Отдельный случай —
 * `\n`: это может быть и настоящий перенос строки, который просили сохранить, и начало
 * команды (`\ne`, `\nu`, `\nabla`). Команды LaTeX всегда из латинских букв, поэтому
 * удваиваем только когда за `n` идёт латиница; перед русским текстом это перенос.
 */
export function repairJsonBackslashes(raw: string): string {
  // Символ после escape нужен только для решения — забираем его lookahead-ом,
  // иначе следующий обратный слэш проскочит мимо проверки.
  return raw.replace(/\\([\s\S])(?=([\s\S]?))/g, (match, next: string, after: string) => {
    if (next === "\\" || next === '"' || next === "/") {
      return match;
    }

    if (next === "n" && !/[a-zA-Z]/.test(after)) {
      return match;
    }

    return `\\\\${next}`;
  });
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

/**
 * Номер из файла: строка из цифр как в задачнике («010203»), ведущие нули значимы.
 * JSON-число тоже принимается (нули в нём невозможны, но «"number": 301001» модели
 * шлют постоянно); дроби и номера с буквами отклоняются.
 */
function readImportNumber(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!IMPORT_NUMBER_PATTERN.test(trimmed) || normalizeHomeworkNumber(trimmed) === "0") {
      return null;
    }

    return trimmed;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 999_999_999_999) {
    return String(value);
  }

  return null;
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
  // Дедупликация по нормализованному виду: «01» и «1» — один номер, берётся первый.
  const seen = new Set<string>();
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
    const number = readImportNumber(item.number);

    if (number === null) {
      issues.push(`Пропущена запись с неверным номером: ${JSON.stringify(item.number ?? null)}.`);
      continue;
    }

    const normalizedNumber = normalizeHomeworkNumber(number);

    if (seen.has(normalizedNumber)) {
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

    seen.add(normalizedNumber);
    numbers.push({ number, conditionLatex, answerLatex: answerRaw || null });
  }

  if (numbers.length === 0) {
    return { ok: false, error: "В файле нет ни одной задачи, которую удалось бы разобрать." };
  }

  numbers.sort((a, b) => compareHomeworkNumbers(a.number, b.number));

  const warnings = Array.isArray(record.warnings)
    ? record.warnings
        .map((value) => normalizeSingleLineText(readString(value)).slice(0, MAX_IMPORT_WARNING_LENGTH))
        .filter(Boolean)
        .slice(0, MAX_IMPORT_WARNINGS)
    : [];

  return { ok: true, data: { title, description, numbers, warnings, issues } };
}

export type ExistingNumber = {
  number: string;
  conditionLatex: string | null;
  answerLatex: string | null;
};

/** Обновление существующего номера: existingNumber — записанный вид в теме
 * (может отличаться от файла ведущими нулями), по нему идёт запись в базу. */
export type ImportPlanUpdate = ImportNumber & {
  existingNumber: string;
};

export type ImportPlan = {
  /** Номеров, которых в теме ещё нет. */
  toCreate: ImportNumber[];
  /** Номер есть, но соответствующее поле пустое — заполняем всегда. */
  toFill: ImportPlanUpdate[];
  /** Номер есть, поле заполнено и отличается — только при overwriteFilled. */
  toOverwrite: ImportPlanUpdate[];
  /** Всё уже совпадает — не трогаем. */
  untouched: number;
};

/**
 * Сопоставляет файл с текущим состоянием темы. Ничего не пишет — результат
 * показывается в предпросмотре, чтобы было видно, сколько ручной работы затрётся.
 *
 * Сопоставление — по нормализованному виду: иначе повторный импорт создал бы
 * дубль «010203» рядом с «10203», потерявшим ведущий ноль до миграции.
 */
export function buildImportPlan(parsed: ImportNumber[], existing: ExistingNumber[]): ImportPlan {
  const existingByNumber = new Map(existing.map((row) => [normalizeHomeworkNumber(row.number), row]));

  const plan: ImportPlan = { toCreate: [], toFill: [], toOverwrite: [], untouched: 0 };

  for (const item of parsed) {
    const current = existingByNumber.get(normalizeHomeworkNumber(item.number));

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
      plan.toOverwrite.push({ ...item, existingNumber: current.number });
      continue;
    }

    if (needsFill) {
      plan.toFill.push({ ...item, existingNumber: current.number });
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
