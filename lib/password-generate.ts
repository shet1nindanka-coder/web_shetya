/*
 * Генератор читаемых паролей для аккаунтов учеников и учителей.
 *
 * Формат «Bekuma-472»: слоги из согласной и гласной легко диктовать вслух и
 * переписывать с листка, символы-двойники (l/I/O/0/1) исключены. Проходит
 * validatePasswordStrength: 10 символов, есть буквы и цифры.
 */

const CONSONANTS = "bdfghkmnprstvz";
const VOWELS = "aeou";
const DIGITS = "23456789";

export type RandomIntSource = (maxExclusive: number) => number;

/** Криптослучайный индекс. Смещение от modulo на алфавитах ≤14 пренебрежимо. */
function cryptoRandomInt(maxExclusive: number): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0]! % maxExclusive;
}

export function generateReadablePassword(randomInt: RandomIntSource = cryptoRandomInt): string {
  let word = "";

  for (let index = 0; index < 3; index += 1) {
    word += CONSONANTS[randomInt(CONSONANTS.length)]! + VOWELS[randomInt(VOWELS.length)]!;
  }

  const digits = Array.from({ length: 3 }, () => DIGITS[randomInt(DIGITS.length)]!).join("");

  return `${word.charAt(0).toUpperCase()}${word.slice(1)}-${digits}`;
}
