import { UserRole } from "@prisma/client";
import {
  broadcastNotificationAction,
  flushCachesAction,
  resetAiDailyBudgetAction,
  runRetentionNowAction,
  saveSiteSettingsAction,
  testAiConnectionAction,
  unfreezeChecksAction
} from "@/actions/developer";
import { DeveloperBroadcastRecipients } from "@/components/developer-broadcast-recipients";
import { SectionCard } from "@/components/section-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInternalSettingValue, getSiteSettingsUncached } from "@/lib/site-settings";
import { getHomeworkCheckQueueLength } from "@/lib/solution-check-queue";
import { formatDateTime, formatFileSize } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

function StatBlock({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div
      className="rounded-[16px] border border-[var(--shbz-soft-border)] px-4 py-3.5"
      style={{ background: "var(--shbz-soft-bg)" }}
    >
      <p className="ui-kicker">{label}</p>
      <p className="mt-1 text-[19px] font-extrabold tracking-[-0.3px] text-[var(--theme-text-strong)]">{value}</p>
      {hint ? <p className="ui-copy-muted mt-0.5 text-xs">{hint}</p> : null}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 block">
      <span className="text-sm font-semibold text-[var(--theme-text-strong)]">{children}</span>
      {hint ? <span className="ui-copy-muted block text-xs leading-5">{hint}</span> : null}
    </span>
  );
}

function ActionButton({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <button
        type="submit"
        className="ui-pressable ui-button-secondary w-full rounded-[12px] px-4 py-2.5 text-sm font-semibold transition"
      >
        {label}
      </button>
      <p className="ui-copy-muted mt-1.5 text-xs leading-5">{hint}</p>
    </div>
  );
}

export default async function DeveloperPage({ searchParams }: DeveloperPageProps) {
  await requireUser(UserRole.DEVELOPER);
  const params = await searchParams;
  const settings = await getSiteSettingsUncached();

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [checksLastDay, studentsCount, topicsCount, filesAggregate, lastRetentionRaw, users] = await Promise.all([
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

  const lastRetentionLabel = lastRetentionRaw ? formatDateTime(lastRetentionRaw) : "ещё не выполнялся";
  const inputClass = "ui-input w-full rounded-[12px] px-3 py-2.5 text-sm";

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
    <SectionCard title="Панель разработчика">
      {banners.map((banner, index) => (
        <div
          key={index}
          className={`${banner.tone === "success" ? "ui-notice-success" : "ui-notice-error"} mb-3 rounded-[12px] px-4 py-3 text-sm`}
        >
          {banner.text}
        </div>
      ))}

      <p className="ui-kicker mb-2.5">Статус системы</p>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <StatBlock
          label="Очередь автопроверки"
          value={String(getHomeworkCheckQueueLength())}
          hint="проверок ждут выполнения сейчас"
        />
        <StatBlock
          label="Запусков за 24 часа"
          value={`${checksLastDay} / ${settings.aiDailyLimit}`}
          hint="проверок ИИ · дневной бюджет"
        />
        <StatBlock label="Учеников" value={String(studentsCount)} />
        <StatBlock label="Тем" value={String(topicsCount)} />
        <StatBlock
          label="Файлы в хранилище"
          value={String(filesAggregate._count._all)}
          hint={formatFileSize(filesAggregate._sum.size ?? 0)}
        />
        <StatBlock label="Последнее автоудаление фото" value={lastRetentionLabel ?? "—"} />
      </div>

      <p className="ui-kicker mb-3 mt-8">Действия</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <form action={testAiConnectionAction}>
          <ActionButton label="Проверить подключение к ИИ" hint="Тестовый запрос к модели: доступность и задержка." />
        </form>
        <form action={runRetentionNowAction}>
          <ActionButton label="Автоудаление фото сейчас" hint="Не ждать суточного таймера, удалить просроченное." />
        </form>
        <form action={resetAiDailyBudgetAction}>
          <ActionButton label="Сбросить дневной бюджет ИИ" hint="Обнулить счётчик запусков за сегодня." />
        </form>
        <form action={unfreezeChecksAction}>
          <ActionButton
            label="Разморозить зависшие проверки"
            hint="Пометить FAILED все проверки старше 15 минут."
          />
        </form>
        <form action={flushCachesAction}>
          <ActionButton label="Сбросить кэши платформы" hint="Принудительно обновить данные на всех страницах." />
        </form>
      </div>

      <p className="ui-kicker mb-3 mt-8">Рассылка уведомлений</p>
      <form action={broadcastNotificationAction} className="max-w-2xl space-y-3">
        <label className="block">
          <FieldLabel>Заголовок</FieldLabel>
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            placeholder="Например: завтра занятия не будет"
            className={inputClass}
          />
        </label>
        <label className="block">
          <FieldLabel hint="Необязательно">Текст</FieldLabel>
          <input type="text" name="body" maxLength={300} placeholder="Подробности" className={inputClass} />
        </label>

        <div>
          <FieldLabel hint="Всем сразу или конкретным ученикам">Получатели</FieldLabel>
          <DeveloperBroadcastRecipients students={users.map((student) => ({ id: student.id, name: student.name }))} />
        </div>

        <button type="submit" className="shbz-btn-primary px-5 py-2.5 text-[14px]">
          Отправить уведомление
        </button>
      </form>

      <form action={saveSiteSettingsAction} className="mt-9 space-y-7">
        <div>
          <p className="ui-kicker mb-3">Автопроверка ИИ</p>
          <div className="space-y-4">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-[var(--theme-text-strong)]">
              <input type="checkbox" name="aiEnabled" defaultChecked={settings.aiEnabled} className="h-4 w-4" />
              Автопроверка включена
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <FieldLabel hint="Например gpt-5.6-sol / gpt-5.6-terra. Ключ API остаётся в .env">Модель</FieldLabel>
                <input type="text" name="aiModel" defaultValue={settings.aiModel} maxLength={100} className={inputClass} />
              </label>
              <label className="block">
                <FieldLabel hint="Больше — точнее, но дольше и дороже">Reasoning effort</FieldLabel>
                <select name="aiReasoningEffort" defaultValue={settings.aiReasoningEffort} className={inputClass}>
                  <option value="low">low — быстрый</option>
                  <option value="medium">medium — сбалансированный</option>
                  <option value="high">high — максимальная точность</option>
                </select>
              </label>
              <label className="block">
                <FieldLabel hint="Вердикты с уверенностью ниже порога уходят на ручную проверку (0–1)">
                  Порог уверенности
                </FieldLabel>
                <input
                  type="number"
                  name="aiMinConfidence"
                  defaultValue={settings.aiMinConfidence}
                  min={0}
                  max={1}
                  step={0.05}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel hint="Общий предохранитель расходов на всех учеников">Запусков в день, всего</FieldLabel>
                <input
                  type="number"
                  name="aiDailyLimit"
                  defaultValue={settings.aiDailyLimit}
                  min={1}
                  max={100000}
                  step={1}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel hint="Лимит запусков автопроверки на одного ученика">Запусков в час на ученика</FieldLabel>
                <input
                  type="number"
                  name="aiPerStudentHourlyLimit"
                  defaultValue={settings.aiPerStudentHourlyLimit}
                  min={1}
                  max={1000}
                  step={1}
                  className={inputClass}
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <p className="ui-kicker mb-3">Файлы и хранение</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel hint="0 — не удалять автоматически">Автоудаление фото ДЗ, дней</FieldLabel>
              <input
                type="number"
                name="photoRetentionDays"
                defaultValue={settings.photoRetentionDays}
                min={0}
                max={3650}
                step={1}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Действует на новые загрузки">Максимум фото на одно ДЗ</FieldLabel>
              <input
                type="number"
                name="maxPhotosPerAssignment"
                defaultValue={settings.maxPhotosPerAssignment}
                min={1}
                max={30}
                step={1}
                className={inputClass}
              />
            </label>
            <label className="block">
              <FieldLabel hint="Старые завершённые проверки удаляются вместе со снапшотами фото">
                Хранить завершённых проверок на ученика
              </FieldLabel>
              <input
                type="number"
                name="completedChecksKept"
                defaultValue={settings.completedChecksKept}
                min={1}
                max={500}
                step={1}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="shbz-btn-primary px-6 py-3 text-[14.5px]">
            Сохранить настройки
          </button>
          <p className="ui-hint ui-copy-muted text-xs">
            Значения перекрывают .env и применяются в течение 15 секунд без рестарта.
          </p>
        </div>
      </form>
    </SectionCard>
  );
}
