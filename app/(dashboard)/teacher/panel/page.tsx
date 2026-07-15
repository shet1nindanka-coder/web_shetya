import { UserRole } from "@prisma/client";
import { DeveloperPanel } from "@/components/developer-panel";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInternalSettingValue, getSiteSettingsUncached } from "@/lib/site-settings";
import { getHomeworkCheckQueueLength } from "@/lib/solution-check-queue";
import { formatDateTime, formatFileSize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STORAGE_WARN_BYTES = 512 * 1024 * 1024;

export default async function DeveloperPage() {
  await requireUser(UserRole.DEVELOPER);
  const settings = await getSiteSettingsUncached();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [checksLastDay, studentsCount, topicsCount, filesAggregate, lastRetentionRaw, students] = await Promise.all([
    prisma.homeworkCheck.count({ where: { createdAt: { gte: dayAgo } } }).catch(() => 0),
    prisma.user.count({ where: { role: UserRole.STUDENT } }),
    prisma.topic.count(),
    prisma.storedFile.aggregate({ _count: { _all: true }, _sum: { size: true } }),
    getInternalSettingValue("internal.retentionLastRunAt"),
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const queueLength = getHomeworkCheckQueueLength();
  const filesSizeBytes = filesAggregate._sum.size ?? 0;
  const filesSizeLabel = formatFileSize(filesSizeBytes);
  const lastRetentionLabel = (lastRetentionRaw ? formatDateTime(lastRetentionRaw) : null) ?? "ещё не выполнялся";
  const budgetBusy = checksLastDay >= settings.aiDailyLimit * 0.8;

  return (
    <div>
      <ShbzPageHeader
        kicker="Служебный доступ"
        title="Панель разработчика"
        aside={
          <div className="flex flex-wrap gap-2 pb-1">
            <span
              className="shbz-chip shbz-chip-green"
              style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
            >
              <span className="shbz-pulse-dot" />
              Очередь: {queueLength}
            </span>
            <span className={`shbz-chip ${budgetBusy ? "shbz-chip-yellow" : "shbz-chip-green"}`}>
              ИИ: {checksLastDay} / {settings.aiDailyLimit} за 24 ч
            </span>
            <span
              className={`shbz-chip ${filesSizeBytes > STORAGE_WARN_BYTES ? "shbz-chip-yellow" : ""}`}
              style={
                filesSizeBytes > STORAGE_WARN_BYTES
                  ? undefined
                  : { background: "var(--shbz-tab-hover)", color: "var(--shbz-kicker)" }
              }
            >
              Хранилище: {filesSizeLabel}
            </span>
          </div>
        }
      />

      <DeveloperPanel
        stats={{
          queueLength,
          checksLastDay,
          studentsCount,
          topicsCount,
          filesCount: filesAggregate._count._all,
          filesSizeLabel,
          lastRetentionLabel
        }}
        settings={settings}
        students={students}
      />
    </div>
  );
}
