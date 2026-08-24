import Link from "next/link";
import { AuditCategory, Prisma, UserRole } from "@prisma/client";
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

  const [total, entries, costAggregate, actors] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE
    }),
    // Сводка по деньгам считается по ТЕМ ЖЕ фильтрам, что и таблица: иначе
    // цифра вверху не совпадала бы с тем, что человек видит под ней.
    prisma.auditLog.aggregate({
      where: { ...where, category: AuditCategory.AI },
      _sum: { costRub: true, inputTokens: true, outputTokens: true },
      _count: { _all: true }
    }),
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" }
    })
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const periodLabel = days > 0 ? `за ${days} дн.` : "за всё время";

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

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="shbz-chip">Записей: {total}</span>
          <span className="shbz-chip shbz-chip-green">
            Расход на ИИ {periodLabel}: {formatCost(costAggregate._sum.costRub)}
          </span>
          <span className="shbz-chip">Вызовов модели: {costAggregate._count._all}</span>
          <span className="shbz-chip">
            Токены: {costAggregate._sum.inputTokens ?? 0} → {costAggregate._sum.outputTokens ?? 0}
          </span>
        </div>
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
                    <td className="px-2 py-2.5" style={{ color: "var(--shbz-text-strong)" }}>
                      {entry.actorName ?? "—"}
                      {entry.actorRole ? (
                        <span style={{ color: "var(--shbz-text-muted)" }}> · {ROLE_LABELS[entry.actorRole]}</span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 whitespace-nowrap">
                      <span
                        className={`shbz-chip ${entry.outcome === "failed" ? "shbz-chip-red" : ""}`}
                        style={entry.outcome === "failed" ? undefined : { background: "var(--shbz-tab-hover)" }}
                      >
                        {CATEGORY_LABELS[entry.category]}
                      </span>{" "}
                      <span style={{ color: "var(--shbz-text-strong)" }}>{entry.action}</span>
                    </td>
                    <td className="px-2 py-2.5" style={{ color: "var(--shbz-text-muted)" }}>
                      {entry.summary ?? entry.targetLabel ?? "—"}
                      {entry.error ? (
                        <span className="mt-0.5 block" style={{ color: "var(--shbz-danger-text)" }}>
                          {entry.error}
                        </span>
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
