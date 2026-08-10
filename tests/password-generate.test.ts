import test from "node:test";
import assert from "node:assert/strict";
import { generateReadablePassword } from "@/lib/password-generate";
import { validatePasswordStrength } from "@/lib/password-policy";

const PASSWORD_FORMAT = /^[A-Z][a-z]{5}-\d{3}$/;

test("генерирует пароль формата «Слоги-цифры» без символов-двойников", () => {
  let counter = 0;
  const rng = (max: number) => counter++ % max;
  const password = generateReadablePassword(rng);

  assert.match(password, PASSWORD_FORMAT);
  assert.equal(/[lio01ILO]/.test(password), false);
});

test("сгенерированный пароль проходит парольную политику", () => {
  for (let seed = 0; seed < 20; seed += 1) {
    let counter = seed;
    const rng = (max: number) => (counter += 7) % max;

    assert.equal(validatePasswordStrength(generateReadablePassword(rng)), null);
  }
});

test("криптоисточник по умолчанию тоже даёт валидный формат", () => {
  assert.match(generateReadablePassword(), PASSWORD_FORMAT);
});
