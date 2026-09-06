import Link from "next/link";
import { AuditCategory, Prisma, UserRole } from "@prisma/client";
import { ProgressStatusHistory } from "@/components/progress-status-history";
import { DeveloperJournalFilters } from "@/components/developer-journal-filters";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { DEVELOPER_PANEL_TABS } from "@/lib/developer-panel-tabs";
import { getAuditRetentionDays } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  AI: "ИИ",
  DATA: "Данные",
  AUTH: "Входы"
};

const ROLE_LABELS: Record<UserRole, string> = {
  TEACHER: "учитель",
  STUDENT: "ученик",
  DEVELOPER: "разработчик"
};

/*
 * Русские подписи системных имён действий. Неизвестное имя показывается как
 * есть — журнал не ломается, если появится новое событие раньше подписи.
 * Системное имя всё равно выводится под подписью: по нему работает фильтр.
 */
const ACTION_LABELS: Record<string, string> = {
  "progress.status": "Решение об изменении прогресса",
  "auth.login": "Вход в систему",
  "auth.logout": "Выход из системы",
  "solution.check": "Автопроверка ДЗ",
  "lesson_plan.shortlist": "ИИ-отсев номеров к уроку",
  "lesson_plan.generate": "ИИ-план урока",
  "homework_plan.shortlist": "ИИ-отсев номеров к ДЗ",
  "homework_plan.generate": "ИИ-план ДЗ",
  "number_tagging.run": "Разметка сложности номеров",
  "account.create": "Создание аккаунта",
  "student.create": "Создание ученика",
  "student.delete": "Удаление ученика",
  "student.owner_change": "Смена владельца учеников",
  "student.password_reset": "Сброс пароля ученика",
  "teacher.delete": "Удаление учителя",
  "teacher.password_reset": "Сброс пароля учителя",
  "topic.create": "Создание темы",
  "topic.delete": "Удаление темы",
  "developer.settings_saved": "Панель: настройки сохранены",
  "developer.ai_ping": "Панель: проверка связи с ИИ",
  "developer.retention_run": "Панель: очистка по сроку хранения",
  "developer.ai_budget_reset": "Панель: сброс бюджета ИИ",
  "developer.checks_unfrozen": "Панель: снятие зависших проверок",
  "developer.caches_flushed": "Панель: сброс кэшей",
  "developer.numbers_tagged": "Панель: разметка сложности",
  "developer.broadcast_sent": "Панель: рассылка уведомлений"
};

// Порог, после которого текст ошибки сворачивается в раскрывашку: короткие
// ошибки читаются на месте, простыни не растягивают таблицу.
const ERROR_PREVIEW_MAX = 140;

type SearchParams = {
  category?: string;
  actor?: string;
  action?: string;
  outcome?: string;
  days?: string;
  page?: string;
};

function parseCategory(raw: string | undefined): AuditCategory | null {
  if (raw === "AI" || raw === "DATA" || raw === "AUTH") {
    return raw;
  }

  return null;
}

function parseDays(raw: string | undefined) {
  const parsed = Number(raw);
  // 0 — «за всё время»: удобно, когда ищешь редкое событие и не помнишь дату.
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 365 ? Math.floor(parsed) : 7;
}

function formatCost(value: Prisma.Decimal | null) {
  if (!value) {
    return "—";
  }

  return `${value.toFixed(2)} ₽`;
}

export default async function DeveloperJournalPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireUser(UserRole.DEVELOPER);

  const params = await searchParams;
  const category = parseCategory(params.category);
  const actorId = params.actor?.trim() || null;
  const actionQuery = params.action?.trim() || null;
  const onlyFailed = params.outcome === "failed";
  const days = parseDays(params.days);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  const since = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

  const where: Prisma.AuditLogWhereInput = {
    ...(category ? { category } : {}),
    ...(actorId ? { actorId } : {}),
    // contains без mode: insensitive — имена действий и так в нижнем регистре.
    ...(actionQuery ? { action: { contains: actionQuery } } : {}),
    ...(onlyFailed ? { outcome: "failed" } : {}),
    ...(since ? { createdAt: { gte: since } } : {})
  };

  const [total, entries, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" }
    })
  ]);

  const progressIds = entries.flatMap((entry) => entry.action === "progress.status" && entry.targetId ? [entry.targetId] : []);
  const progressTargets = new Map((progressIds.length ? await prisma.progressStatusEvent.findMany({
    where: { id: { in: progressIds } },
    select: { id: true, student: { select: { name: true } }, homeworkNumber: { select: { number: true, topic: { select: { title: true } } } } }
  }) : []).map((event) => [event.id, `${event.student.name} · № ${event.homeworkNumber.number} · ${event.homeworkNumber.topic.title}`]));

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = new URLSearchParams();
    const merged: SearchParams = {
      category: category ?? undefined,
      actor: actorId ?? undefined,
      action: actionQuery ?? undefined,
      outcome: onlyFailed ? "failed" : undefined,
      days: String(days),
      page: String(page),
      ...overrides
    };

    for (const [key, value] of Object.entries(merged)) {
      if (value) {
        next.set(key, value);
      }
    }

    return `/developer/panel/journal?${next.toString()}`;
  };

  return (
    <div>
      {/* Тот же хедер и таббар, что у панели: журнал — её вкладка, просто со
          своим URL (фильтры и пагинация живут в адресе). */}
      <ShbzPageHeader
        kicker="Служебный доступ"
        title="Панель разработчика"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      <nav className="shbz-seg" aria-label="Разделы панели">
        {DEVELOPER_PANEL_TABS.map((item) => (
          <Link
            key={item.key}
            href={`/developer/panel?tab=${item.key}`}
            className="shbz-seg-btn shbz-seg-btn--plain"
          >
            {item.label}
          </Link>
        ))}
        <span className="shbz-seg-btn shbz-seg-btn--plain" data-active aria-current="page">
          Журнал
        </span>
      </nav>

      <div className="shbz-card shbz-section-pad mt-[18px]">
        <p className="ui-hint mb-4 text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
          Кто и что вызвал на платформе. Записи хранятся {getAuditRetentionDays()} дней, потом удаляются автоматически.
        </p>

        <DeveloperJournalFilters
          category={category ?? ""}
          actorId={actorId ?? ""}
          action={actionQuery ?? ""}
          days={days}
          onlyFailed={onlyFailed}
          actors={actors.map((actor) => ({ id: actor.id, name: actor.name, roleLabel: ROLE_LABELS[actor.role] }))}
        />
      </div>

      <div className="shbz-card shbz-section-pad mt-[18px]">
        {entries.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--shbz-text-muted)" }}>
            За выбранный период записей нет.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-[13px]">
              <thead>
                <tr style={{ color: "var(--shbz-kicker)" }}>
                  <th className="px-2 py-2 text-left font-semibold">Когда</th>
                  <th className="px-2 py-2 text-left font-semibold">Кто</th>
                  <th className="px-2 py-2 text-left font-semibold">Действие</th>
                  <th className="px-2 py-2 text-left font-semibold">Что</th>
                  <th className="px-2 py-2 text-right font-semibold">Токены</th>
                  <th className="px-2 py-2 text-right font-semibold">Стоимость</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: "1px solid var(--shbz-soft-border)" }}>
                    <td className="px-2 py-2.5 whitespace-nowrap" style={{ color: "var(--shbz-text-muted)" }}>
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td
                      className="max-w-[180px] break-words px-2 py-2.5"
                      style={{ color: "var(--shbz-text-strong)", overflowWrap: "anywhere" }}
                    >
                      {entry.actorName ?? "—"}
                      {entry.actorRole ? (
                        <span className="whitespace-nowrap" style={{ color: "var(--shbz-text-muted)" }}>
                          {" "}
                          · {ROLE_LABELS[entry.actorRole]}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[240px] px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`shbz-chip shrink-0 ${entry.outcome === "failed" ? "shbz-chip-red" : ""}`}
                          style={entry.outcome === "failed" ? undefined : { background: "var(--shbz-tab-hover)" }}
                        >
                          {CATEGORY_LABELS[entry.category]}
                        </span>
                        <span style={{ color: "var(--shbz-text-strong)" }}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                      </div>
                      {ACTION_LABELS[entry.action] ? (
                        <div className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--shbz-kicker)" }}>
                          {entry.action}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className="max-w-[380px] break-words px-2 py-2.5"
                      style={{ color: "var(--shbz-text-muted)", overflowWrap: "anywhere" }}
                    >
                      {entry.targetId && progressTargets.has(entry.targetId) ? (
                        <p className="mb-1 font-semibold">{progressTargets.get(entry.targetId)}</p>
                      ) : null}
                      {entry.summary ?? entry.targetLabel ?? "—"}
                      {entry.action === "progress.status" && entry.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta)
                        && typeof entry.meta.studentId === "string" && typeof entry.meta.homeworkNumberId === "string" ? (
                        <>
                          <ProgressStatusHistory studentId={entry.meta.studentId} homeworkNumberId={entry.meta.homeworkNumberId} />
                          <details className="mt-1">
                            <summary className="cursor-pointer underline">Детали записи</summary>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.meta, null, 2)}</pre>
                          </details>
                        </>
                      ) : null}
                      {entry.error ? (
                        entry.error.length > ERROR_PREVIEW_MAX ? (
                          <details className="mt-0.5">
                            <summary
                              className="cursor-pointer select-none"
                              style={{ color: "var(--shbz-danger-text)" }}
                            >
                              {entry.error.slice(0, ERROR_PREVIEW_MAX)}… <span className="underline">полностью</span>
                            </summary>
                            <span className="mt-1 block" style={{ color: "var(--shbz-danger-text)" }}>
                              {entry.error}
                            </span>
                          </details>
                        ) : (
                          <span className="mt-0.5 block" style={{ color: "var(--shbz-danger-text)" }}>
                            {entry.error}
                          </span>
                        )
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap" style={{ color: "var(--shbz-text-muted)" }}>
                      {entry.inputTokens === null && entry.outputTokens === null
                        ? "—"
                        : `${entry.inputTokens ?? 0} → ${entry.outputTokens ?? 0}`}
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap" style={{ color: "var(--shbz-text-strong)" }}>
                      {formatCost(entry.costRub)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <div className="mt-5 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link href={buildHref({ page: String(page - 1) })} className="shbz-btn-outline">
                Назад
              </Link>
            ) : (
              <span />
            )}
            <span className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
              Страница {page} из {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={buildHref({ page: String(page + 1) })} className="shbz-btn-outline">
                Дальше
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
