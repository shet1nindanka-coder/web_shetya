import { pruneExpiredAuditLogs } from "@/lib/audit";
import { logErrorEvent, logInfoEvent } from "@/lib/logger";
import { pruneExpiredHomeworkPhotos } from "@/lib/homework-photo-retention";

const SWEEP_STARTUP_DELAY_MS = 5 * 60_000;
const SWEEP_INTERVAL_MS = 24 * 60 * 60_000;

declare global {
  // Защита от повторной регистрации таймеров (hot reload в dev).
  var __homeworkPhotoRetentionJobStarted__: boolean | undefined;
}

async function sweep() {
  try {
    await pruneExpiredHomeworkPhotos();

    // Журнал действий чистится тем же суточным проходом: отдельный таймер под
    // один DELETE не нужен, а срок хранения у них одинаково «по дням».
    const auditPrune = await pruneExpiredAuditLogs();

    if (auditPrune.deleted > 0) {
      logInfoEvent("retention.audit_pruned", { deleted: auditPrune.deleted });
    }

    const { setInternalSettingValue } = await import("@/lib/site-settings");
    await setInternalSettingValue("internal.retentionLastRunAt", new Date().toISOString());
  } catch (error) {
    logErrorEvent(
      "retention.sweep_failed",
      {},
      error instanceof Error ? error : undefined,
      "Homework photo retention sweep failed."
    );
  }
}

export function startHomeworkPhotoRetentionJob() {
  if (global.__homeworkPhotoRetentionJobStarted__) {
    return;
  }

  global.__homeworkPhotoRetentionJobStarted__ = true;
  setTimeout(() => void sweep(), SWEEP_STARTUP_DELAY_MS);
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
}
