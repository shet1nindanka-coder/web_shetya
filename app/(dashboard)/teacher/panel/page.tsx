import { UserRole } from "@prisma/client";
import { DeveloperPanel, type DeveloperPanelTab } from "@/components/developer-panel";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInternalSettingValue, getSiteSettingsUncached } from "@/lib/site-settings";
import { getHomeworkCheckQueueLength } from "@/lib/solution-check-queue";
import { formatDateTime, formatFileSize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STORAGE_WARN_BYTES = 512 * 1024 * 1024;

type DeveloperPageProps = {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    ai?: string;
    aiInfo?: string;
    retention?: string;
    retentionFiles?: string;
    unfrozen?: string;
    done?: string;
    broadcast?: string;
  }>;
};

function resolveInitialTab(params: Awaited<DeveloperPageProps["searchParams"]>): DeveloperPanelTab {
  if (params.saved || params.error === "save") return "settings";
  if (params.broadcast !== undefined || params.error === "invalid") return "broadcast";
  if (params.ai || params.retention !== undefined || params.unfrozen !== undefined || params.done || params.error)
    return "actions";
  return "status";
}

export default async function DeveloperPage({ searchParams }: DeveloperPageProps) {
  await requireUser(UserRole.DEVELOPER);
  const params = await searchParams;
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

  const banners: Array<{ tone: "success" | "error"; text: string }> = [];

  if (params.saved) banners.push({ tone: "success", text: "Настройки сохранены и применены." });
  if (params.error === "save")
    banners.push({ tone: "error", text: "Не удалось сохранить настройки. Применена ли миграция SiteSetting?" });
  if (params.error === "invalid") banners.push({ tone: "error", text: "Проверьте заполнение формы." });
  if (params.error && !["save", "invalid"].includes(params.error))
    banners.push({ tone: "error", text: "Действие не выполнено — подробности в логах сервера." });
  if (params.ai === "ok") banners.push({ tone: "success", text: `Модель отвечает: ${params.aiInfo ?? ""}` });
  if (params.ai === "fail") banners.push({ tone: "error", text: `Модель недоступна: ${params.aiInfo ?? ""}` });
  if (params.ai === "off") banners.push({ tone: "error", text: "Автопроверка выключена или не настроен ключ/модель." });
  if (params.retention !== undefined)
    banners.push({
      tone: "success",
      text: `Автоудаление выполнено: снято ссылок на фото — ${params.retention}, удалено файлов — ${params.retentionFiles ?? 0}.`
    });
  if (params.unfrozen !== undefined)
    banners.push({ tone: "success", text: `Зависших проверок снято: ${params.unfrozen}.` });
  if (params.done === "budget") banners.push({ tone: "success", text: "Дневной бюджет автопроверки сброшен." });
  if (params.done === "caches") banners.push({ tone: "success", text: "Кэши платформы сброшены." });
  if (params.broadcast !== undefined)
    banners.push({ tone: "success", text: `Уведомление отправлено ученикам: ${params.broadcast}.` });

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

      {banners.length > 0 ? (
        <div className="mb-6 space-y-3">
          {banners.map((banner, index) => (
            <div
              key={index}
              className={`${banner.tone === "success" ? "shbz-notice-success" : "shbz-notice-error"} ui-fade-slide px-5 py-4 text-sm font-medium`}
              aria-live="polite"
            >
              {banner.text}
            </div>
          ))}
        </div>
      ) : null}

      <DeveloperPanel
        initialTab={resolveInitialTab(params)}
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
