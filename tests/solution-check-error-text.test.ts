import test from "node:test";
import assert from "node:assert/strict";
import { humanizeSolutionCheckError } from "../lib/solution-check-error-text";

test("humanizeSolutionCheckError переводит классы отказов в русский текст с следующим шагом", () => {
  assert.match(humanizeSolutionCheckError("The operation was aborted"), /остановлена/);
  assert.match(humanizeSolutionCheckError("Request timed out after 120000ms"), /остановлена/);
  assert.match(humanizeSolutionCheckError("You exceeded your current quota, please check your plan"), /Лимит/);
  assert.match(humanizeSolutionCheckError("Модель вернула статус 503: upstream error"), /недоступен или перегружен/);
  assert.match(humanizeSolutionCheckError("Rate limit reached for requests"), /недоступен или перегружен/);
  assert.match(humanizeSolutionCheckError("Очередь проверок переполнена"), /слишком много проверок/);
  assert.match(humanizeSolutionCheckError("Invalid image format in message content"), /фото решения/);
});

test("humanizeSolutionCheckError не пропускает сырой текст провайдера наружу", () => {
  const raw = "Model API error 500: internal server error at upstream";
  const message = humanizeSolutionCheckError(raw);

  assert.ok(!message.includes("500"));
  assert.ok(!/[a-z]{3,}/i.test(message.replace(/[А-Яа-яЁё\s.,—«»-]/g, "")));
});

test("humanizeSolutionCheckError возвращает запасной текст для пустых и неизвестных ошибок", () => {
  assert.match(humanizeSolutionCheckError(null), /на нашей стороне/);
  assert.match(humanizeSolutionCheckError(""), /на нашей стороне/);
  assert.match(humanizeSolutionCheckError("weird unknown failure xyz"), /на нашей стороне/);
});
