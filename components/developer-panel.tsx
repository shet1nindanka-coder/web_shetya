"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
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
import type { SiteSettings } from "@/lib/site-settings";

export type DeveloperPanelTab = "status" | "actions" | "broadcast" | "settings";

export type DeveloperPanelStats = {
  queueLength: number;
  checksLastDay: number;
  studentsCount: number;
  topicsCount: number;
  filesCount: number;
  filesSizeLabel: string;
  lastRetentionLabel: string;
};

type DeveloperPanelProps = {
  initialTab: DeveloperPanelTab;
  stats: DeveloperPanelStats;
  settings: SiteSettings;
  students: Array<{ id: string; name: string }>;
};

const TABS: Array<{ key: DeveloperPanelTab; label: string }> = [
  { key: "status", label: "Статус" },
  { key: "actions", label: "Действия" },
  { key: "broadcast", label: "Рассылка" },
  { key: "settings", label: "Настройки" }
];

function StatBlock({
  label,
  value,
  hint,
  children
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[16px] border px-[22px] py-5"
      style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
    >
      <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      <div className="mt-2 text-[19px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
        {value}
      </div>
      {children}
      {hint ? (
        <div className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-[9px] block">
      <span className="block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        {children}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--shbz-text-muted)" }}>
          {hint}
        </span>
      ) : null}
    </span>
  );
}

function ActionButton({ label, hint }: { label: string; hint: string }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <button type="submit" disabled={pending} className="shbz-btn-outline w-full">
        <span className="inline-flex items-center justify-center gap-2">
          {pending ? <span className="shbz-spinner" aria-hidden /> : null}
          {pending ? "Выполняем…" : label}
        </span>
      </button>
      <p aria-live="polite" className="mt-2 text-xs leading-5" style={{ color: "var(--shbz-text-muted)" }}>
        {pending ? "Действие выполняется, не закрывайте страницу." : hint}
      </p>
    </div>
  );
}

function SubmitPrimaryButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="shbz-btn-primary px-[26px] py-[13px] text-[15px]">
      <span className="inline-flex items-center justify-center gap-2.5">
        {pending ? <span className="shbz-spinner" aria-hidden /> : null}
        {pending ? pendingLabel : label}
      </span>
    </button>
  );
}

export function DeveloperPanel({ initialTab, stats, settings, students }: DeveloperPanelProps) {
  const [tab, setTab] = useState<DeveloperPanelTab>(initialTab);
  const [aiOn, setAiOn] = useState(settings.aiEnabled);

  const budgetPercent = Math.min(100, Math.round((stats.checksLastDay / Math.max(1, settings.aiDailyLimit)) * 100));

  return (
    <div>
      <nav className="shbz-seg" aria-label="Разделы панели">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className="shbz-seg-btn shbz-seg-btn--plain"
            data-active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-[18px]">
        {tab === "status" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <StatBlock
                label="Очередь автопроверки"
                value={
                  <span className="inline-flex items-center gap-2.5">
                    <span className="shbz-pulse-dot" />
                    {stats.queueLength}
                  </span>
                }
                hint="проверок ждут выполнения сейчас"
              />
              <StatBlock
                label="Запусков за 24 часа"
                value={
                  <>
                    {stats.checksLastDay} <span style={{ color: "var(--shbz-kicker)" }}>/ {settings.aiDailyLimit}</span>
                  </>
                }
                hint="дневной бюджет ИИ"
              >
                <div
                  className="mt-2.5 h-1.5 overflow-hidden rounded-[999px]"
                  style={{ background: "var(--shbz-seg-bg)" }}
                  aria-hidden
                >
                  <div
                    className="h-full min-w-[7px] rounded-[999px]"
                    style={{ width: `${budgetPercent}%`, background: "var(--shbz-accent-grad)" }}
                  />
                </div>
              </StatBlock>
              <StatBlock label="Файлы в хранилище" value={String(stats.filesCount)} hint={stats.filesSizeLabel} />
              <StatBlock label="Учеников" value={String(stats.studentsCount)} />
              <StatBlock label="Тем" value={String(stats.topicsCount)} />
              <StatBlock
                label="Последнее автоудаление фото"
                value={<span className="text-[16px]">{stats.lastRetentionLabel}</span>}
              />
            </div>
          </div>
        ) : null}

        {tab === "actions" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
                <ActionButton label="Разморозить зависшие проверки" hint="Пометить FAILED все проверки старше 15 минут." />
              </form>
              <form action={flushCachesAction}>
                <ActionButton label="Сбросить кэши платформы" hint="Принудительно обновить данные на всех страницах." />
              </form>
            </div>
          </div>
        ) : null}

        {tab === "broadcast" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <form action={broadcastNotificationAction} className="max-w-2xl space-y-5">
              <label className="block">
                <FieldLabel>Заголовок</FieldLabel>
                <input
                  type="text"
                  name="title"
                  required
                  maxLength={120}
                  placeholder="Например: завтра занятия не будет"
                  className="shbz-input"
                />
              </label>
              <label className="block">
                <FieldLabel hint="Необязательно">Текст</FieldLabel>
                <input type="text" name="body" maxLength={300} placeholder="Подробности" className="shbz-input" />
              </label>

              <div>
                <FieldLabel hint="Всем сразу или конкретным ученикам">Получатели</FieldLabel>
                <DeveloperBroadcastRecipients students={students} />
              </div>

              <SubmitPrimaryButton label="Отправить уведомление" pendingLabel="Отправляем…" />
            </form>
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <form action={saveSiteSettingsAction}>
              <p className="shbz-kicker mb-4">Автопроверка ИИ</p>

              <label className="shbz-switch">
                <input
                  type="checkbox"
                  name="aiEnabled"
                  defaultChecked={settings.aiEnabled}
                  onChange={(event) => setAiOn(event.target.checked)}
                />
                <span className="shbz-switch-track" />
                <span className="shbz-switch-knob" />
                <span>
                  <span className="block text-[14px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                    Автопроверка ИИ
                  </span>
                  <span className="block text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                    {aiOn
                      ? "включена — решения учеников проверяются автоматически"
                      : "выключена — все решения ждут ручной проверки"}
                  </span>
                </span>
              </label>

              <div className="mt-[18px] grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <label className="flex flex-col">
                  <FieldLabel hint="Например gpt-5.6-sol / gpt-5.6-terra. Ключ API остаётся в .env">Модель</FieldLabel>
                  <input type="text" name="aiModel" defaultValue={settings.aiModel} maxLength={100} className="shbz-input mt-auto" />
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Больше — точнее, но дольше и дороже">Reasoning effort</FieldLabel>
                  <select name="aiReasoningEffort" defaultValue={settings.aiReasoningEffort} className="shbz-input mt-auto">
                    <option value="low">low — быстрый</option>
                    <option value="medium">medium — сбалансированный</option>
                    <option value="high">high — максимальная точность</option>
                  </select>
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Ниже порога — на ручную проверку (0–1)">Порог уверенности</FieldLabel>
                  <input
                    type="number"
                    name="aiMinConfidence"
                    defaultValue={settings.aiMinConfidence}
                    min={0}
                    max={1}
                    step={0.05}
                    className="shbz-input mt-auto"
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Общий предохранитель расходов">Запусков в день, всего</FieldLabel>
                  <input
                    type="number"
                    name="aiDailyLimit"
                    defaultValue={settings.aiDailyLimit}
                    min={1}
                    max={100000}
                    step={1}
                    className="shbz-input mt-auto"
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Лимит на одного ученика">Запусков в час на ученика</FieldLabel>
                  <input
                    type="number"
                    name="aiPerStudentHourlyLimit"
                    defaultValue={settings.aiPerStudentHourlyLimit}
                    min={1}
                    max={1000}
                    step={1}
                    className="shbz-input mt-auto"
                  />
                </label>
              </div>

              <p className="shbz-kicker mb-4 mt-8">Файлы и хранение</p>
              <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                <label className="flex flex-col">
                  <FieldLabel hint="0 — не удалять автоматически">Автоудаление фото ДЗ, дней</FieldLabel>
                  <input
                    type="number"
                    name="photoRetentionDays"
                    defaultValue={settings.photoRetentionDays}
                    min={0}
                    max={3650}
                    step={1}
                    className="shbz-input mt-auto"
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Действует на новые загрузки">Максимум фото на одно ДЗ</FieldLabel>
                  <input
                    type="number"
                    name="maxPhotosPerAssignment"
                    defaultValue={settings.maxPhotosPerAssignment}
                    min={1}
                    max={30}
                    step={1}
                    className="shbz-input mt-auto"
                  />
                </label>
                <label className="flex flex-col">
                  <FieldLabel hint="Старые удаляются со снапшотами фото">Хранить завершённых проверок на ученика</FieldLabel>
                  <input
                    type="number"
                    name="completedChecksKept"
                    defaultValue={settings.completedChecksKept}
                    min={1}
                    max={500}
                    step={1}
                    className="shbz-input mt-auto"
                  />
                </label>
              </div>

              <div className="mt-[26px] flex flex-wrap items-center gap-3.5">
                <SubmitPrimaryButton label="Сохранить настройки" pendingLabel="Сохраняем…" />
                <p className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
                  Значения перекрывают .env и применяются в течение 15 секунд без рестарта.
                </p>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
