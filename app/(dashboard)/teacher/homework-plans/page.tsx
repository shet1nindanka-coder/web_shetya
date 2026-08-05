import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { requireUser } from "@/lib/auth";
import { getHomeworkPlans } from "@/lib/platform-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomeworkPlansPage() {
  const user = await requireUser([UserRole.TEACHER, UserRole.DEVELOPER]);
  const prefix = user.role === UserRole.DEVELOPER ? "/developer" : "/teacher";
  const plans = await getHomeworkPlans();

  return (
    <div>
      <ShbzPageHeader kicker="Домашние задания" title="ИИ-выдача ДЗ" aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />} />

      {plans.length === 0 ? (
        <div className="shbz-card px-6 py-10 text-center">
          <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
            Черновиков ДЗ пока нет.
          </p>
          <p className="mt-1.5 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Создайте черновик со страницы урока («Выдать ДЗ по итогам занятия»), группы или ученика.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {plans.map((plan) => (
            <article key={plan.id} className="shbz-card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="min-w-0">
                <h3 className="truncate text-[16px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                  {plan.title}
                </h3>
                <p className="mt-1 text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                  {formatDateTime(plan.createdAt)}
                  {plan.topicTitle ? ` · ${plan.topicTitle}` : ""}
                  {plan.groupName ? ` · ${plan.groupName}` : ""}
                  {plan.deadlineAt ? ` · дедлайн ${formatDateTime(plan.deadlineAt)}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {plan.failedCount > 0 ? (
                  <span className="shbz-chip" style={{ background: "var(--shbz-danger-bg)", color: "var(--shbz-danger-text)" }}>
                    ошибок: {plan.failedCount}
                  </span>
                ) : null}
                <span
                  className={`shbz-chip ${plan.issuedCount === plan.participantsCount && plan.participantsCount > 0 ? "shbz-chip-green" : "shbz-chip-yellow"}`}
                >
                  выдано {plan.issuedCount} из {plan.participantsCount}
                </span>
                <Link href={`${prefix}/homework-plans/${plan.id}`} className="shbz-btn-outline inline-block no-underline">
                  Открыть
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
