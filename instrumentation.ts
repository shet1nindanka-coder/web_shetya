// Фоновые задачи одного инстанса: запускаются при старте сервера Next.
// Сейчас здесь только ретеншен фото ДЗ (автоудаление спустя год, см.
// HOMEWORK_PHOTO_RETENTION_DAYS). При переходе на несколько инстансов
// перенести в выделенный воркер.
const SWEEP_STARTUP_DELAY_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 24 * 60 * 60_000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const sweep = async () => {
    try {
      const { pruneExpiredHomeworkPhotos } = await import("@/lib/homework-photo-retention");
      await pruneExpiredHomeworkPhotos();
    } catch (error) {
      const { logErrorEvent } = await import("@/lib/logger");
      logErrorEvent(
        "retention.sweep_failed",
        {},
        error instanceof Error ? error : undefined,
        "Homework photo retention sweep failed."
      );
    }
  };

  setTimeout(() => void sweep(), SWEEP_STARTUP_DELAY_MS);
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
}
