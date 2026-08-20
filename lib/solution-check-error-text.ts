// Граница между диагностикой для разработчика и сообщением для человека:
// сырой текст ошибки провайдера остаётся в pino-логах, ученику показывается
// русское сообщение с конкретным следующим шагом.

const FALLBACK_MESSAGE =
  "Проверка не удалась — что-то сломалось на нашей стороне. Попробуйте ещё раз, а если не получится — напишите преподавателю.";

const ERROR_CLASSES: Array<{ pattern: RegExp; message: string }> = [
  {
    // Таймаут запроса к модели (AbortError / timeout).
    pattern: /abort|time.?out|таймаут|timed out/i,
    message: "Проверка шла слишком долго и была остановлена. Подождите пару минут и запустите её ещё раз."
  },
  {
    // Бюджет / квота исчерпаны.
    pattern: /quota|insufficient|billing|balance|budget|бюджет|лимит провер/i,
    message: "Лимит автоматических проверок пока исчерпан. Попробуйте позже или напишите преподавателю — он проверит вручную."
  },
  {
    // Провайдер перегружен или недоступен (5xx / 429 / rate limit).
    pattern: /статус 5\d\d|статус 429|rate.?limit|too many|overload|unavailable|bad gateway|connect|fetch failed|ECONN/i,
    message: "Сервис проверки сейчас недоступен или перегружен. Попробуйте ещё раз через несколько минут."
  },
  {
    // Очередь проверок переполнена или сброшена.
    pattern: /очеред/i,
    message: "Сейчас слишком много проверок одновременно. Подождите пару минут и запустите проверку снова."
  },
  {
    // Фото не читаются моделью.
    pattern: /image|photo|фото|изображен|unsupported format/i,
    message: "Не получилось разобрать фото решения. Переснимите страницы при хорошем свете, без бликов, и загрузите заново."
  }
];

/**
 * Переводит техническую ошибку ИИ-проверки в понятное ученику русское
 * сообщение с следующим шагом. Никогда не возвращает сырой текст провайдера.
 */
export function humanizeSolutionCheckError(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) {
    return FALLBACK_MESSAGE;
  }

  for (const entry of ERROR_CLASSES) {
    if (entry.pattern.test(raw)) {
      return entry.message;
    }
  }

  return FALLBACK_MESSAGE;
}
