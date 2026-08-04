/**
 * Разрушающая правка поля «Номера» в теме.
 *
 * Раньше `updateTopicAction` молча удалял всё, чего нет в новом списке, а каскады
 * схемы уносили прогресс, заметки и дедлайны ВСЕХ учеников, LaTeX-условия и ответы,
 * результаты ИИ-проверок и пункты уроков (PROD-002). Одна опечатка обнуляла часть
 * полугодового прогресса класса, а интерфейс писал «Изменения по теме сохранены».
 *
 * Здесь — чистая логика: что именно исчезнет и требуется ли подтверждение.
 * Загрузка агрегатов из БД — в `loadTopicNumbersImpact` ниже (prisma импортируется
 * лениво, чтобы модуль можно было гонять в юнит-тестах без подключения к базе).
 */

import { compareHomeworkNumbers } from "@/lib/utils";

/** Номер темы с посчитанными «следами» чужого труда. */
export type TopicNumberFacts = {
  id: string;
  number: string;
  /** Сколько учеников имеют по номеру статус светофора. */
  studentsWithStatus: number;
  /** Сколько учеников написали по номеру заметку. */
  studentsWithNote: number;
  /** Сколько учеников имеют по номеру назначенный дедлайн. */
  studentsWithDeadline: number;
  /** В скольких выданных ДЗ номер лежит прямо сейчас. */
  activeAssignments: number;
  /** Сколько вердиктов ИИ-проверок ссылается на номер. */
  checkResults: number;
  /** В скольких наборах уроков/черновиков ДЗ номер стоит. */
  lessonItems: number;
  hasCondition: boolean;
  hasAnswer: boolean;
  hasAnswerFile: boolean;
};

export type TopicNumberImpact = TopicNumberFacts & {
  /** С номером связан чужой труд: удаление безвозвратно. */
  hasStudentWork: boolean;
  /** Номер лежит в активном ДЗ: удаление молча «ухудшает» выданное задание. */
  isAssigned: boolean;
  /** Готовая строка для диалога подтверждения. */
  summary: string;
};

export type TopicNumbersChangePlan = {
  /** Номера, которые исчезнут из темы, вместе с последствиями. */
  removed: TopicNumberImpact[];
  /** Номера, которые появятся. */
  added: string[];
  /** Сколько номеров остаётся как есть. */
  keptCount: number;
  /** Есть ли среди удаляемых хоть один со следами работы — тогда нужен явный ответ. */
  requiresConfirmation: boolean;
  /** Есть ли среди удаляемых номера из активных ДЗ — нужна отдельная галочка. */
  requiresAssignedConfirmation: boolean;
};

function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} ${one}`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} ${few}`;
  }

  return `${count} ${many}`;
}

/** Человекочитаемое перечисление последствий удаления одного номера. */
export function describeNumberImpact(facts: TopicNumberFacts): string {
  const parts: string[] = [];

  if (facts.studentsWithStatus > 0) {
    parts.push(`статус у ${pluralize(facts.studentsWithStatus, "ученика", "учеников", "учеников")}`);
  }

  if (facts.studentsWithNote > 0) {
    parts.push(`заметки у ${pluralize(facts.studentsWithNote, "ученика", "учеников", "учеников")}`);
  }

  if (facts.studentsWithDeadline > 0) {
    parts.push(`дедлайн у ${pluralize(facts.studentsWithDeadline, "ученика", "учеников", "учеников")}`);
  }

  if (facts.activeAssignments > 0) {
    parts.push(`входит в ${pluralize(facts.activeAssignments, "активное ДЗ", "активных ДЗ", "активных ДЗ")}`);
  }

  if (facts.checkResults > 0) {
    parts.push(`${pluralize(facts.checkResults, "вердикт", "вердикта", "вердиктов")} ИИ-проверки`);
  }

  if (facts.lessonItems > 0) {
    parts.push(`${pluralize(facts.lessonItems, "пункт", "пункта", "пунктов")} в наборах занятий`);
  }

  if (facts.hasCondition && facts.hasAnswer) {
    parts.push("условие и ответ");
  } else if (facts.hasCondition) {
    parts.push("условие");
  } else if (facts.hasAnswer) {
    parts.push("ответ");
  }

  if (facts.hasAnswerFile) {
    parts.push("файл с ответом");
  }

  return parts.length > 0 ? parts.join(", ") : "ничего не потеряется";
}

export function hasStudentWork(facts: TopicNumberFacts): boolean {
  return (
    facts.studentsWithStatus > 0 ||
    facts.studentsWithNote > 0 ||
    facts.studentsWithDeadline > 0 ||
    facts.activeAssignments > 0 ||
    facts.checkResults > 0 ||
    facts.lessonItems > 0 ||
    facts.hasCondition ||
    facts.hasAnswer ||
    facts.hasAnswerFile
  );
}

/** Что случится, если заменить набор номеров темы на `nextNumbers`. */
export function buildTopicNumbersChangePlan(
  existing: TopicNumberFacts[],
  nextNumbers: string[]
): TopicNumbersChangePlan {
  const nextSet = new Set(nextNumbers);
  const existingSet = new Set(existing.map((entry) => entry.number));

  const removed: TopicNumberImpact[] = existing
    .filter((entry) => !nextSet.has(entry.number))
    .sort((left, right) => compareHomeworkNumbers(left.number, right.number))
    .map((entry) => ({
      ...entry,
      hasStudentWork: hasStudentWork(entry),
      isAssigned: entry.activeAssignments > 0,
      summary: describeNumberImpact(entry)
    }));

  const added = Array.from(new Set(nextNumbers))
    .filter((number) => !existingSet.has(number))
    .sort(compareHomeworkNumbers);

  return {
    removed,
    added,
    keptCount: existing.length - removed.length,
    requiresConfirmation: removed.some((entry) => entry.hasStudentWork),
    requiresAssignedConfirmation: removed.some((entry) => entry.isAssigned)
  };
}

/**
 * Сверяет подтверждение пользователя с реально удаляемым набором.
 *
 * Подтверждение — это список номеров, который человек увидел в диалоге. Если между
 * показом диалога и сохранением набор изменился (другая вкладка, импорт, чужая
 * правка), подтверждение считается недействительным и сохранять нельзя.
 */
export function isRemovalConfirmationValid(plan: TopicNumbersChangePlan, confirmedNumbers: string[]): boolean {
  if (!plan.requiresConfirmation) {
    return true;
  }

  const needed = plan.removed.filter((entry) => entry.hasStudentWork).map((entry) => entry.number);
  const confirmed = new Set(confirmedNumbers);

  return needed.length > 0 && needed.every((number) => confirmed.has(number));
}

/** Разбирает значение скрытого поля подтверждения: «301, 0302» → ["301", "0302"]. */
export function parseConfirmedNumbers(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((value) => /^\d+$/.test(value));
}

export type TopicImpactSummary = {
  /** Всего номеров в теме. */
  totalNumbers: number;
  /** Номеров, за которыми стоит чья-то работа. */
  numbersWithWork: number;
  /** Сумма выставленных статусов по всем номерам темы (по всем ученикам). */
  statusCount: number;
  noteCount: number;
  activeAssignments: number;
  checkResults: number;
  lessonItems: number;
  numbersWithCondition: number;
  numbersWithAnswer: number;
};

/** Что стоит за темой целиком — для честного диалога удаления темы (ARCH-013). */
export function summarizeTopicImpact(facts: TopicNumberFacts[]): TopicImpactSummary {
  return facts.reduce<TopicImpactSummary>(
    (summary, entry) => ({
      totalNumbers: summary.totalNumbers + 1,
      numbersWithWork: summary.numbersWithWork + (hasStudentWork(entry) ? 1 : 0),
      statusCount: summary.statusCount + entry.studentsWithStatus,
      noteCount: summary.noteCount + entry.studentsWithNote,
      activeAssignments: summary.activeAssignments + entry.activeAssignments,
      checkResults: summary.checkResults + entry.checkResults,
      lessonItems: summary.lessonItems + entry.lessonItems,
      numbersWithCondition: summary.numbersWithCondition + (entry.hasCondition ? 1 : 0),
      numbersWithAnswer: summary.numbersWithAnswer + (entry.hasAnswer ? 1 : 0)
    }),
    {
      totalNumbers: 0,
      numbersWithWork: 0,
      statusCount: 0,
      noteCount: 0,
      activeAssignments: 0,
      checkResults: 0,
      lessonItems: 0,
      numbersWithCondition: 0,
      numbersWithAnswer: 0
    }
  );
}

/** Список последствий удаления темы — по строке на пункт, только непустые. */
export function describeTopicImpact(summary: TopicImpactSummary): string[] {
  const lines: string[] = [];

  if (summary.statusCount > 0) {
    lines.push(`${pluralize(summary.statusCount, "статус", "статуса", "статусов")} светофора у учеников`);
  }

  if (summary.noteCount > 0) {
    lines.push(`${pluralize(summary.noteCount, "заметка", "заметки", "заметок")} учеников`);
  }

  if (summary.activeAssignments > 0) {
    lines.push(
      `${pluralize(summary.activeAssignments, "номер", "номера", "номеров")} из активных ДЗ (сами ДЗ тоже удалятся вместе с фото решений)`
    );
  }

  if (summary.checkResults > 0) {
    lines.push(`${pluralize(summary.checkResults, "вердикт", "вердикта", "вердиктов")} ИИ-проверок`);
  }

  if (summary.lessonItems > 0) {
    lines.push(`${pluralize(summary.lessonItems, "пункт", "пункта", "пунктов")} в наборах занятий и черновиках ДЗ`);
  }

  if (summary.numbersWithCondition > 0 || summary.numbersWithAnswer > 0) {
    lines.push(
      `LaTeX: условий — ${summary.numbersWithCondition}, ответов — ${summary.numbersWithAnswer}`
    );
  }

  return lines;
}

/**
 * Считает следы работы по всем номерам темы. Prisma тянется лениво — так же,
 * как в `lib/homework-photo-retention.ts`, чтобы чистая логика выше оставалась
 * тестируемой без базы.
 */
export async function loadTopicNumberFacts(topicId: string): Promise<TopicNumberFacts[]> {
  const { prisma } = await import("@/lib/prisma");

  const numbers = await prisma.topicHomeworkNumber.findMany({
    where: { topicId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      number: true,
      conditionLatex: true,
      answerLatex: true,
      answerFileId: true,
      statuses: {
        select: { status: true, note: true, deadlineAt: true }
      },
      assignmentEntries: {
        select: { id: true }
      },
      _count: {
        select: { checkResults: true, assignmentItems: true }
      }
    }
  });

  return numbers.map((entry) => ({
    id: entry.id,
    number: entry.number,
    studentsWithStatus: entry.statuses.filter((status) => status.status !== null).length,
    studentsWithNote: entry.statuses.filter((status) => (status.note ?? "").trim().length > 0).length,
    studentsWithDeadline: entry.statuses.filter((status) => status.deadlineAt !== null).length,
    activeAssignments: entry.assignmentEntries.length,
    checkResults: entry._count.checkResults,
    lessonItems: entry._count.assignmentItems,
    hasCondition: (entry.conditionLatex ?? "").trim().length > 0,
    hasAnswer: (entry.answerLatex ?? "").trim().length > 0,
    hasAnswerFile: entry.answerFileId !== null
  }));
}
