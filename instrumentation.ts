// Фоновые задачи одного инстанса. ВАЖНО: register собирается и для edge-рантайма,
// поэтому весь node-код подключается ТОЛЬКО через динамический импорт внутри
// проверки NEXT_RUNTIME — webpack вырезает его из edge-бандла.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startHomeworkPhotoRetentionJob } = await import("./lib/homework-photo-retention-job");
    startHomeworkPhotoRetentionJob();
  }
}
