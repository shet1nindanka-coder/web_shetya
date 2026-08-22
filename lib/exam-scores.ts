/*
 * Справочные таблицы баллов для вкладки «Общая инфа» ученика.
 * Чистые данные без логики; при обновлении шкал ФИПИ правится только этот файл.
 * Источник — шкалы ФИПИ (ЕГЭ профиль — 32 первичных, ОГЭ — 31 первичный).
 */

export type ScoreRow = { primary: number; secondary: number };
export type TaskScoringRow = { badge: string; text: string };
export type GradeRow = { grade: number; range: string; note?: string };

/** ЕГЭ профильная математика: первичный → тестовый балл. */
export const EGE_PROFILE_SCALE: ScoreRow[] = [
  [1, 6], [2, 11], [3, 17], [4, 22], [5, 27], [6, 34], [7, 40], [8, 46],
  [9, 52], [10, 58], [11, 64], [12, 70], [13, 72], [14, 74], [15, 76], [16, 78],
  [17, 80], [18, 82], [19, 84], [20, 86], [21, 88], [22, 90], [23, 92], [24, 94],
  [25, 95], [26, 96], [27, 97], [28, 98], [29, 99], [30, 100], [31, 100], [32, 100]
].map(([primary, secondary]) => ({ primary, secondary }));

export const EGE_PROFILE_MAX_PRIMARY = 32;
export const EGE_PROFILE_MIN_PRIMARY = 5; // порог «сдал» (27 тестовых)

export const EGE_PROFILE_TASKS: TaskScoringRow[] = [
  { badge: "1", text: "№ 1–12 — по 1 первичному баллу" },
  { badge: "2", text: "№ 13, 15, 16 — по 2 первичных балла" },
  { badge: "3", text: "№ 14 и 17 — по 3 первичных балла" },
  { badge: "4", text: "№ 18 и 19 — по 4 первичных балла" }
];

/** ЕГЭ базовая математика: 21 задание по 1 баллу, оценка по первичным. */
export const EGE_BASE_MAX_PRIMARY = 21;
export const EGE_BASE_GRADES: GradeRow[] = [
  { grade: 5, range: "17–21" },
  { grade: 4, range: "12–16" },
  { grade: 3, range: "7–11" },
  { grade: 2, range: "0–6" }
];

/** ОГЭ математика: 25 заданий, 31 первичный балл, оценка по первичным. */
export const OGE_MAX_PRIMARY = 31;
export const OGE_TASKS: TaskScoringRow[] = [
  { badge: "1", text: "№ 1–19 (часть 1) — по 1 первичному баллу" },
  { badge: "2", text: "№ 20–25 (часть 2, развёрнутый ответ) — по 2 первичных балла" }
];
export const OGE_GRADES: GradeRow[] = [
  { grade: 5, range: "22–31" },
  { grade: 4, range: "15–21" },
  { grade: 3, range: "8–14", note: "из них не меньше 2 баллов за геометрию (№ 15–19, 23–25)" },
  { grade: 2, range: "0–7" }
];
