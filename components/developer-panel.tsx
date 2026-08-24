"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, useTransition, type ReactNode } from "react";
import {
  broadcastNotificationAction,
  flushCachesAction,
  resetAiDailyBudgetAction,
  runRetentionNowAction,
  saveSiteSettingsAction,
  tagNumbersDifficultyAction,
  testAiConnectionAction,
  unfreezeChecksAction
} from "@/actions/developer";
import { DeveloperBroadcastRecipients } from "@/components/developer-broadcast-recipients";
import { ShbzSelect } from "@/components/shbz-select";
import type { ReasoningEffort, SiteSettings } from "@/lib/site-settings";
import { DEVELOPER_PANEL_TABS, type DeveloperPanelTab } from "@/lib/developer-panel-tabs";

export type { DeveloperPanelTab } from "@/lib/developer-panel-tabs";

export type DeveloperPanelStats = {
  queueLength: number;
  checksLastDay: number;
  studentsCount: number;
  topicsCount: number;
  filesCount: number;
  filesSizeLabel: string;
  lastRetentionLabel: string;
  taggedNumbersCount: number;
  totalNumbersCount: number;
  lessonQueueLength: number;
};

type ActionResult = { ok: boolean; message: string };

type DeveloperPanelProps = {
  stats: DeveloperPanelStats;
  settings: SiteSettings;
  students: Array<{ id: string; name: string }>;
  /** Чипы статуса — рендерятся справа от таббара панели. */
  statusChips?: ReactNode;
  /** Вкладка при открытии — из ?tab=, чтобы возврат со страницы журнала попадал куда нужно. */
  initialTab?: DeveloperPanelTab;
};

const EFFORT_OPTIONS = [
  { value: "low", label: "low — быстрый" },
  { value: "medium", label: "medium — сбалансированный" },
  { value: "high", label: "high — максимальная точность" }
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

function resultColor(result: ActionResult | null) {
  if (!result) return "var(--shbz-text-muted)";
  return result.ok ? "var(--shbz-green-text)" : "var(--shbz-danger-text)";
}

/** Кнопка сервисного действия: вызывает server action без перезагрузки, результат — под кнопкой. */
function ActionForm({
  action,
  label,
  hint
}: {
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  label: string;
  hint: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    async (prevState: ActionResult | null, formData: FormData) => {
      const result = await action(prevState, formData);
      // Обновляем серверные данные (статус, чипы) фоном, без перезагрузки страницы.
      router.refresh();
      return result;
    },
    null
  );

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} className="shbz-btn-outline w-full">
        <span className="inline-flex items-center justify-center gap-2">
          {pending ? <span className="shbz-spinner" aria-hidden /> : null}
          {pending ? "Выполняем…" : label}
        </span>
      </button>
      <p
        aria-live="polite"
        className={`mt-2 text-xs leading-5 ${state && !pending ? "ui-fade-slide" : ""}`}
        style={{ color: pending ? "var(--shbz-text-muted)" : resultColor(state) }}
      >
        {pending ? "Действие выполняется…" : state ? state.message : hint}
      </p>
    </form>
  );
}

/** Рассылка: отправка без перезагрузки, при успехе форма и выбранные ученики очищаются. */
function BroadcastForm({ students }: { students: Array<{ id: string; name: string }> }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await broadcastNotificationAction(formData);
      setResult(response);

      if (response.ok) {
        formRef.current?.reset();
        setPickerKey((key) => key + 1);
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-2xl space-y-5">
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
        <DeveloperBroadcastRecipients key={pickerKey} students={students} />
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <button type="submit" disabled={pending} className="shbz-btn-primary shbz-btn-primary--lg">
          <span className="inline-flex items-center justify-center gap-2.5">
            {pending ? <span className="shbz-spinner" aria-hidden /> : null}
            {pending ? "Отправляем…" : "Отправить уведомление"}
          </span>
        </button>
        {result && !pending ? (
          <p aria-live="polite" className="ui-fade-slide text-[13px] font-medium" style={{ color: resultColor(result) }}>
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Настройки: сохранение без перезагрузки, значения в форме не сбрасываются. */
function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [aiOn, setAiOn] = useState(settings.aiEnabled);
  const [effort, setEffort] = useState<ReasoningEffort>(settings.aiReasoningEffort);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await saveSiteSettingsAction(formData);
      setResult(response);

      if (response.ok) {
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={onSubmit}>
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
        <div className="flex flex-col">
          <FieldLabel hint="Больше — точнее, но дольше и дороже">Reasoning effort</FieldLabel>
          <div className="mt-auto">
            <ShbzSelect
              value={effort}
              onChange={(value) => setEffort(value as ReasoningEffort)}
              options={EFFORT_OPTIONS}
              ariaLabel="Reasoning effort"
            />
            <input type="hidden" name="aiReasoningEffort" value={effort} />
          </div>
        </div>
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

      <p className="shbz-kicker mb-4 mt-8">ИИ-подбор уроков</p>
      <label className="shbz-switch">
        <input type="checkbox" name="lessonPlanEnabled" defaultChecked={settings.lessonPlanEnabled} />
        <span className="shbz-switch-track" />
        <span className="shbz-switch-knob" />
        <span className="text-[14px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
          Подбор заданий на урок включён
        </span>
      </label>
      <div className="mt-[18px] grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <label className="flex flex-col">
          <FieldLabel hint="Сколько кандидатов уходит во второй этап с полными условиями">Шорт-лист, номеров</FieldLabel>
          <input
            type="number"
            name="lessonPlanShortlistSize"
            defaultValue={settings.lessonPlanShortlistSize}
            min={20}
            max={150}
            step={1}
            className="shbz-input mt-auto"
          />
        </label>
        <label className="flex flex-col">
          <FieldLabel hint="Потолок задач в наборе одного ученика">Максимум задач в плане</FieldLabel>
          <input
            type="number"
            name="lessonPlanMaxItems"
            defaultValue={settings.lessonPlanMaxItems}
            min={5}
            max={60}
            step={1}
            className="shbz-input mt-auto"
          />
        </label>
        <label className="flex flex-col">
          <FieldLabel hint="Сколько учеников генерируются одновременно">Параллельных генераций</FieldLabel>
          <input
            type="number"
            name="lessonPlanConcurrency"
            defaultValue={settings.lessonPlanConcurrency}
            min={1}
            max={10}
            step={1}
            className="shbz-input mt-auto"
          />
        </label>
      </div>

      <p className="shbz-kicker mb-4 mt-8">ИИ-выдача ДЗ</p>
      <label className="shbz-switch">
        <input type="checkbox" name="homeworkPlanEnabled" defaultChecked={settings.homeworkPlanEnabled} />
        <span className="shbz-switch-track" />
        <span className="shbz-switch-knob" />
        <span className="text-[14px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
          Подбор домашних заданий включён
        </span>
      </label>
      <div className="mt-[18px] grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <label className="flex flex-col">
          <FieldLabel hint="Домашка заметно меньше урочного набора">Максимум задач в ДЗ</FieldLabel>
          <input
            type="number"
            name="homeworkPlanMaxItems"
            defaultValue={settings.homeworkPlanMaxItems}
            min={3}
            max={60}
            step={1}
            className="shbz-input mt-auto"
          />
        </label>
        <label className="flex flex-col">
          <FieldLabel hint="Сколько кандидатов уходит во второй этап">Шорт-лист ДЗ, номеров</FieldLabel>
          <input
            type="number"
            name="homeworkPlanShortlistSize"
            defaultValue={settings.homeworkPlanShortlistSize}
            min={20}
            max={150}
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
        <label className="flex flex-col">
          <FieldLabel hint="Показывается на странице входа; пусто — строка скрыта">
            Контакт для «не получается войти»
          </FieldLabel>
          <input
            type="text"
            name="loginHelpContact"
            defaultValue={settings.loginHelpContact}
            maxLength={200}
            className="shbz-input mt-auto"
          />
        </label>
      </div>

      <div className="mt-[26px] flex flex-wrap items-center gap-3.5">
        <button type="submit" disabled={pending} className="shbz-btn-primary shbz-btn-primary--lg">
          <span className="inline-flex items-center justify-center gap-2.5">
            {pending ? <span className="shbz-spinner" aria-hidden /> : null}
            {pending ? "Сохраняем…" : "Сохранить настройки"}
          </span>
        </button>
        <p
          aria-live="polite"
          className={`text-[13px] ${result && !pending ? "ui-fade-slide font-medium" : ""}`}
          style={{ color: pending ? "var(--shbz-text-muted)" : resultColor(result) }}
        >
          {pending
            ? "Сохраняем настройки…"
            : result
              ? result.message
              : "Значения перекрывают .env и применяются в течение 15 секунд без рестарта."}
        </p>
      </div>
    </form>
  );
}

export function DeveloperPanel({ stats, settings, students, statusChips, initialTab }: DeveloperPanelProps) {
  const [tab, setTab] = useState<DeveloperPanelTab>(initialTab ?? "status");

  const budgetPercent = Math.min(100, Math.round((stats.checksLastDay / Math.max(1, settings.aiDailyLimit)) * 100));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <nav className="shbz-seg" aria-label="Разделы панели">
          {DEVELOPER_PANEL_TABS.map((item) => (
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
          {/* Журнал — отдельная страница, а не вкладка: у него свои фильтры и
              пагинация в адресе, чтобы ссылку на выборку можно было сохранить. */}
          <Link href="/developer/panel/journal" className="shbz-seg-btn shbz-seg-btn--plain">
            Журнал
          </Link>
        </nav>
        {statusChips}
      </div>

      <div className="mt-[18px]">
        {tab === "status" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <StatBlock
                label="Очередь автопроверки"
                value={String(stats.queueLength)}
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
              <StatBlock
                label="Очередь подбора уроков"
                value={String(stats.lessonQueueLength)}
                hint="персональных наборов ждут генерации"
              />
              <StatBlock label="Файлы в хранилище" value={String(stats.filesCount)} hint={stats.filesSizeLabel} />
              <StatBlock label="Учеников" value={String(stats.studentsCount)} />
              <StatBlock label="Тем" value={String(stats.topicsCount)} />
              <StatBlock
                label="Сложность номеров"
                value={
                  <>
                    {stats.taggedNumbersCount}{" "}
                    <span style={{ color: "var(--shbz-kicker)" }}>/ {stats.totalNumbersCount}</span>
                  </>
                }
                hint="размечено ИИ или вручную"
              />
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
              <ActionForm
                action={testAiConnectionAction}
                label="Проверить подключение к ИИ"
                hint="Тестовый запрос к модели: доступность и задержка."
              />
              <ActionForm
                action={runRetentionNowAction}
                label="Автоудаление фото сейчас"
                hint="Не ждать суточного таймера, удалить просроченное."
              />
              <ActionForm
                action={tagNumbersDifficultyAction}
                label="Разметить сложность номеров (ИИ)"
                hint="До 100 неразмеченных номеров за запуск: сложность 1–10 и время решения. Ручные оценки не перезаписываются."
              />
              <ActionForm
                action={resetAiDailyBudgetAction}
                label="Сбросить дневной бюджет ИИ"
                hint="Обнулить счётчик запусков за сегодня."
              />
              <ActionForm
                action={unfreezeChecksAction}
                label="Разморозить зависшие проверки"
                hint="Пометить FAILED все проверки старше 15 минут."
              />
              <ActionForm
                action={flushCachesAction}
                label="Сбросить кэши платформы"
                hint="Принудительно обновить данные на всех страницах."
              />
            </div>
          </div>
        ) : null}

        {tab === "broadcast" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <BroadcastForm students={students} />
          </div>
        ) : null}

        {tab === "settings" ? (
          <div className="shbz-card shbz-section-pad ui-fade-slide">
            <SettingsForm settings={settings} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
