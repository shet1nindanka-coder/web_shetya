/*
 * Генератор читаемых паролей для аккаунтов учеников и учителей.
 *
 * Два режима:
 * — generatePasswordFromName: транслит фамилии + цифры («Smirnova-472») —
 *   основной сценарий в формах создания, пароль легко связать с учеником;
 * — generateReadablePassword: случайное слово из слогов («Bekuma-472») —
 *   запасной вариант, когда из имени не собрать латинское слово.
 * Оба проходят validatePasswordStrength: ≥8 символов, есть буквы и цифры.
 */

const CONSONANTS = "bdfghkmnprstvz";
const VOWELS = "aeou";
// Без символов-двойников (l/I/O/0/1): пароль диктуют вслух и переписывают с листка.
const DIGITS = "23456789";

export type RandomIntSource = (maxExclusive: number) => number;

/** Криптослучайный индекс. Смещение от modulo на алфавитах ≤14 пренебрежимо. */
function cryptoRandomInt(maxExclusive: number): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0]! % maxExclusive;
}

function randomDigits(count: number, randomInt: RandomIntSource): string {
  return Array.from({ length: count }, () => DIGITS[randomInt(DIGITS.length)]!).join("");
}

export function generateReadablePassword(randomInt: RandomIntSource = cryptoRandomInt): string {
  let word = "";

  for (let index = 0; index < 3; index += 1) {
    word += CONSONANTS[randomInt(CONSONANTS.length)]! + VOWELS[randomInt(VOWELS.length)]!;
  }

  return `${word.charAt(0).toUpperCase()}${word.slice(1)}-${randomDigits(3, randomInt)}`;
}

const RU_TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya"
};

/** Кириллица → латиница; латинские буквы остаются, всё прочее отбрасывается. */
export function transliterateRuToLatin(text: string): string {
  let result = "";

  // NFC: macOS может прислать «й» как «и» + комбинируемый знак — склеиваем обратно.
  for (const char of text.normalize("NFC").toLowerCase()) {
    if (char >= "a" && char <= "z") {
      result += char;
    } else {
      result += RU_TRANSLIT[char] ?? "";
    }
  }

  return result;
}

/*
 * Пароль из фамилии: «Мария Смирнова» → «Smirnova-472». Фамилией считаем
 * последнее слово — так подсказывает и плейсхолдер формы («Имя Фамилия»).
 * Если из слова не собрать хотя бы 3 латинские буквы, отдаём случайное слово.
 */
export function generatePasswordFromName(fullName: string, randomInt: RandomIntSource = cryptoRandomInt): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const surname = words.length > 0 ? words[words.length - 1]! : "";
  const latin = transliterateRuToLatin(surname).slice(0, 16);

  if (latin.length < 3) {
    return generateReadablePassword(randomInt);
  }

  const capitalized = latin.charAt(0).toUpperCase() + latin.slice(1);
  // Итог должен быть не короче 8 символов (политика): слово + дефис + цифры.
  const digitCount = Math.max(3, 7 - capitalized.length);

  return `${capitalized}-${randomDigits(digitCount, randomInt)}`;
}
