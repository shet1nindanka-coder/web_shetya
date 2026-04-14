import Link from "next/link";
import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { ProgressTimelineChart } from "@/components/progress-timeline-chart";
import { ProgressBar } from "@/components/progress-bar";
import { TeacherProgressTimelineFilter } from "@/components/teacher-progress-timeline-filter";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TeacherStatisticsDrilldown } from "@/components/teacher-statistics-drilldown";
import { requireUser } from "@/lib/auth";
import { getProgressTimeline, getTeacherTopicsOverview } from "@/lib/platform-data";
import { completionPercent, cx, toIsoDateTimeString } from "@/lib/utils";

type TeacherTopicsOverview = Awaited<ReturnType<typeof getTeacherTopicsOverview>>;
type TopicOverview = TeacherTopicsOverview["topics"][number];

type TopicAnalytics = TopicOverview & {
  solvedCount: number;
  emptyCount: number;
  solvedPercent: number;
  redPercent: number;
};

type StudentAnalytics = {
  id: string;
  name: string;
  email: string;
  markedCount: number;
  solvedCount: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  coveragePercent: number;
  solvedPercent: number;
  redPercent: number;
};

type DistributionSegment = {
  key: string;
  label: string;
  note: string;
  value: number;
  color: string;
  badgeClassName: string;
};

type TeacherStatisticsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const statisticsViews = [
  { key: "teacher", label: "Для учителя", href: "/teacher/statistics" },
  { key: "developer", label: "Для разработчиков", href: "/teacher/statistics?view=developer" }
] as const;

export default async function TeacherStatisticsPage({ searchParams }: TeacherStatisticsPageProps) {
  await requireUser(UserRole.TEACHER);

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedView = typeof resolvedSearchParams.view === "string" ? resolvedSearchParams.view : undefined;
  const requestedStudentId =
    typeof resolvedSearchParams.studentId === "string" ? resolvedSearchParams.studentId : undefined;
  const view = requestedView === "developer" ? "developer" : "teacher";
  const data = await getTeacherTopicsOverview();
  const selectedTimelineStudent =
    data.students.find((student) => student.id === requestedStudentId) ?? null;
  const totalStatusSlots = data.stats.totalStudents * data.stats.totalNumbers;

  const studentStatsMap = new Map(
    data.students.map((student) => [
      student.id,
      {
        id: student.id,
        name: student.name,
        email: student.email,
        markedCount: 0,
        solvedCount: 0,
        greenCount: 0,
        yellowCount: 0,
        redCount: 0,
        coveragePercent: 0,
        solvedPercent: 0,
        redPercent: 0
      } satisfies StudentAnalytics
    ])
  );

  const topicAnalytics: TopicAnalytics[] = data.topics.map((topic) => {
    for (const number of topic.homeworkNumbers) {
      for (const status of number.statuses) {
        const current = studentStatsMap.get(status.studentId);

        if (!current) {
          continue;
        }

        current.markedCount += 1;

        if (status.status === HomeworkNumberStatus.GREEN) {
          current.greenCount += 1;
          current.solvedCount += 1;
        } else if (status.status === HomeworkNumberStatus.YELLOW) {
          current.yellowCount += 1;
          current.solvedCount += 1;
        } else if (status.status === HomeworkNumberStatus.RED) {
          current.redCount += 1;
        }
      }
    }

    const solvedCount = topic.greenCount + topic.yellowCount;
    const emptyCount = Math.max(topic.totalSlots - topic.markedCount, 0);

    return {
      ...topic,
      solvedCount,
      emptyCount,
      solvedPercent: completionPercent(solvedCount, topic.totalSlots),
      redPercent: completionPercent(topic.redCount, topic.totalSlots)
    };
  });

  const studentStats = Array.from(studentStatsMap.values()).map((student) => ({
    ...student,
    coveragePercent: completionPercent(student.markedCount, data.stats.totalNumbers),
    solvedPercent: completionPercent(student.solvedCount, data.stats.totalNumbers),
    redPercent: completionPercent(student.redCount, data.stats.totalNumbers)
  }));

  const totalGreen = topicAnalytics.reduce((sum, topic) => sum + topic.greenCount, 0);
  const totalYellow = topicAnalytics.reduce((sum, topic) => sum + topic.yellowCount, 0);
  const totalRed = topicAnalytics.reduce((sum, topic) => sum + topic.redCount, 0);
  const totalSolved = totalGreen + totalYellow;
  const totalUnfilled = Math.max(totalStatusSlots - data.stats.totalMarked, 0);
  const activeTopics = topicAnalytics.filter((topic) => topic.studentsWithActivity > 0);
  const activeStudents = studentStats.filter((student) => student.markedCount > 0);
  const strongestTopics = [...topicAnalytics]
    .sort((left, right) => right.solvedPercent - left.solvedPercent || right.solvedCount - left.solvedCount)
    .slice(0, 5);
  const attentionTopics = [...topicAnalytics]
    .filter((topic) => topic.redCount > 0)
    .sort((left, right) => right.redCount - left.redCount || right.redPercent - left.redPercent)
    .slice(0, 5);
  const engagedStudents = [...studentStats]
    .filter((student) => student.markedCount > 0)
    .sort((left, right) => right.solvedCount - left.solvedCount || right.markedCount - left.markedCount)
    .slice(0, 5);
  const supportStudents = [...studentStats]
    .filter((student) => student.redCount > 0)
    .sort((left, right) => right.redCount - left.redCount || right.redPercent - left.redPercent)
    .slice(0, 5);

  const distributionSegments: DistributionSegment[] = [
    {
      key: "green",
      label: "Зеленые",
      note: "Уверенно решены",
      value: totalGreen,
      color: "#34d399",
      badgeClassName: "border-[var(--theme-success-border)] bg-[var(--theme-success-soft)] text-[var(--theme-success-text)]"
    },
    {
      key: "yellow",
      label: "Желтые",
      note: "Исправлены после самопроверки",
      value: totalYellow,
      color: "#fbbf24",
      badgeClassName: "border-[var(--theme-warning-border)] bg-[var(--theme-warning-soft)] text-[var(--theme-warning-text)]"
    },
    {
      key: "red",
      label: "Красные",
      note: "Требуют помощи преподавателя",
      value: totalRed,
      color: "#fb7185",
      badgeClassName: "border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger-text)]"
    },
    {
      key: "empty",
      label: "Без статуса",
      note: "Номер еще не отмечен",
      value: totalUnfilled,
      color: "#cbd5e1",
      badgeClassName: "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]"
    }
  ];

  const activeTopicsPercent = completionPercent(activeTopics.length, data.stats.totalTopics);
  const activeStudentsPercent = completionPercent(activeStudents.length, data.stats.totalStudents);
  const solvedPercent = completionPercent(totalSolved, totalStatusSlots);
  const headlineTitle =
    view === "teacher" ? "Статистика для подготовки к занятиям" : "Общая аналитика платформы";
  const headlineDescription =
    view === "teacher"
      ? "Темп прогресса по времени и точечный срез по теме и ученику."
      : "Общие метрики и аналитика платформы.";
  const progressTimelineEntries = await getProgressTimeline(selectedTimelineStudent?.id, 112);
  const drilldownTopics = data.topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    totalNumbers: topic.totalNumbers,
    homeworkNumbers: topic.homeworkNumbers.map((number) => ({
      id: number.id,
      number: number.number,
      statuses: number.statuses.map((status) => ({
        studentId: status.studentId,
        status: status.status as HomeworkNumberStatus | null,
        deadlineAt: toIsoDateTimeString(status.deadlineAt ?? null)
      }))
    }))
  }));
  const drilldownStudents = data.students.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email
  }));

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Статистика"
        title={headlineTitle}
        description={headlineDescription}
      />

      <nav className="ui-fade-slide ui-tab-shell ui-tab-strip flex gap-1.5 rounded-[8px] p-1.5 sm:flex-wrap sm:rounded-[10px] sm:p-2">
        {statisticsViews.map((item) => {
          const isActive = item.key === view;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx("ui-pressable ui-tab shrink-0 rounded-[8px] px-4 py-2.5 text-sm font-medium sm:px-4.5", isActive && "data-[active=true]:shadow-none")}
              data-active={isActive}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {view === "teacher" ? (
        <>
          <SectionCard
            title="Динамика прогресса"
            action={
              <TeacherProgressTimelineFilter
                students={data.students.map((student) => ({
                  id: student.id,
                  name: student.name
                }))}
                selectedStudentId={selectedTimelineStudent?.id ?? ""}
              />
            }
          >
            <ProgressTimelineChart
              entries={progressTimelineEntries}
              selectedStudentName={selectedTimelineStudent?.name ?? null}
            />
          </SectionCard>

          <SectionCard title="Срез по теме и ученику">
            <TeacherStatisticsDrilldown topics={drilldownTopics} students={drilldownStudents} />
          </SectionCard>

        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
            <StatCard
              label="Решено"
              value={totalSolved}
              stagger={1}
              accent={<span className="font-semibold text-[var(--theme-success-text)]">{solvedPercent}% от всех слотов</span>}
            />
            <StatCard
              label="Нужна помощь"
              value={totalRed}
              stagger={2}
              accent={<span className="font-semibold text-[var(--theme-danger-text)]">{completionPercent(totalRed, totalStatusSlots)}% от всех слотов</span>}
            />
            <StatCard
              label="Без статуса"
              value={totalUnfilled}
              stagger={3}
              accent={<span className="font-semibold text-[var(--theme-text-default)]">{completionPercent(totalUnfilled, totalStatusSlots)}% от всех слотов</span>}
            />
            <StatCard
              label="Активные ученики"
              value={`${activeStudents.length} / ${data.stats.totalStudents}`}
              stagger={4}
              accent={<span className="font-semibold text-[var(--theme-accent-text)]">{activeStudentsPercent}% охвата</span>}
            />
          </div>

          <SectionCard title="Как распределяется прогресс">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="ui-surface ui-panel-soft rounded-[8px] p-3.5 sm:rounded-[10px] sm:p-6">
                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <DonutChart segments={distributionSegments} total={totalStatusSlots} centerValue={`${solvedPercent}%`} centerLabel="решено" />
                  <div className="w-full space-y-3">
                    {distributionSegments.map((segment) => (
                      <div key={segment.key} className="ui-card-soft rounded-2xl px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                            <div>
                              <p className="text-sm font-semibold text-[var(--theme-text-strong)]">{segment.label}</p>
                              <p className="text-xs leading-5 text-[var(--theme-text-muted)]">{segment.note}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-[var(--theme-text-strong)]">{segment.value}</p>
                            <p className="text-xs text-[var(--theme-text-muted)]">{completionPercent(segment.value, totalStatusSlots)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="ui-surface ui-panel-soft rounded-[8px] p-3.5 sm:rounded-[10px] sm:p-6">
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[var(--theme-text-muted)]">
                      <span>Решено уверенно</span>
                      <span className="font-semibold text-[var(--theme-text-strong)]">
                        {totalSolved} / {totalStatusSlots}
                      </span>
                    </div>
                    <ProgressBar value={solvedPercent} size="sm" />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[var(--theme-text-muted)]">
                      <span>Темы с активностью</span>
                      <span className="font-semibold text-[var(--theme-text-strong)]">
                        {activeTopics.length} / {data.stats.totalTopics}
                      </span>
                    </div>
                    <ProgressBar value={activeTopicsPercent} size="sm" />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[var(--theme-text-muted)]">
                      <span>Ученики в работе</span>
                      <span className="font-semibold text-[var(--theme-text-strong)]">
                        {activeStudents.length} / {data.stats.totalStudents}
                      </span>
                    </div>
                    <ProgressBar value={activeStudentsPercent} size="sm" />
                  </div>

                  <div className="ui-card-soft rounded-[8px] sm:rounded-[10px] px-4 py-4">
                    <p className="text-sm font-medium text-[var(--theme-text-muted)]">Ключевой вывод</p>
                    <p className="mt-2 text-base font-semibold text-[var(--theme-text-strong)]">
                      {totalUnfilled > totalSolved
                        ? "Неотмеченных номеров пока больше, чем реально решенных. Здесь главный резерв роста."
                        : totalRed > 0
                          ? "Основной фокус сейчас не на охвате, а на разборе красных номеров и снятии трудностей."
                          : "Охват уже хороший: можно смещать внимание на качество и скорость прохождения тем."}
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </SectionCard>

          <SectionCard title="Что происходит по темам">
            <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
              <RankingCard
                title="Лучшее усвоение"
                emptyMessage="Пока нет тем с прогрессом."
                items={strongestTopics.map((topic) => ({
                  key: topic.id,
                  title: topic.title,
                  subtitle: `${topic.solvedCount} решено · ${topic.studentsWithActivity} учеников в работе`,
                  valueLabel: `${topic.solvedPercent}%`,
                  progress: topic.solvedPercent,
                  tone: "emerald"
                }))}
              />

              <RankingCard
                title="Где чаще нужна помощь"
                emptyMessage="Пока нет тем с красными статусами."
                items={attentionTopics.map((topic) => ({
                  key: topic.id,
                  title: topic.title,
                  subtitle: `${topic.redCount} красных · ${topic.markedCount} отмеченных статусов`,
                  valueLabel: `${topic.redPercent}%`,
                  progress: topic.redPercent,
                  tone: "rose"
                }))}
              />
            </div>
          </SectionCard>

          <SectionCard title="Что происходит по ученикам">
            <div className="grid gap-3 sm:gap-4 xl:grid-cols-2">
              <RankingCard
                title="Самые вовлеченные"
                emptyMessage="Пока у учеников нет отмеченных номеров."
                items={engagedStudents.map((student) => ({
                  key: student.id,
                  title: student.name,
                  subtitle: `${student.solvedCount} решено · ${student.markedCount} отмечено`,
                  valueLabel: `${student.solvedPercent}%`,
                  progress: student.solvedPercent,
                  tone: "brand"
                }))}
              />

              <RankingCard
                title="Нужен разбор"
                emptyMessage="Сейчас нет учеников с красными статусами."
                items={supportStudents.map((student) => ({
                  key: student.id,
                  title: student.name,
                  subtitle: `${student.redCount} красных · ${student.solvedCount} решено`,
                  valueLabel: `${student.redPercent}%`,
                  progress: student.redPercent,
                  tone: "rose"
                }))}
              />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function DonutChart({
  segments,
  total,
  centerValue,
  centerLabel
}: {
  segments: DistributionSegment[];
  total: number;
  centerValue: string;
  centerLabel: string;
}) {
  const backgroundImage = buildConicGradient(segments, total);

  return (
    <div className="relative mx-auto h-52 w-52 shrink-0 sm:h-56 sm:w-56">
      <div
        className="h-full w-full rounded-full border border-[var(--theme-border-soft)] shadow-inner"
        style={{
          background: backgroundImage
        }}
      />
      <div className="absolute inset-6 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-xl sm:text-2xl font-semibold text-[var(--theme-text-strong)]">{centerValue}</span>
        <span className="mt-1 text-sm text-[var(--theme-text-muted)]">{centerLabel}</span>
      </div>
    </div>
  );
}

function RankingCard({
  title,
  emptyMessage,
  items
}: {
  title: string;
  emptyMessage: string;
  items: Array<{
    key: string;
    title: string;
    subtitle: string;
    valueLabel: string;
    progress: number;
    tone: "brand" | "emerald" | "rose";
  }>;
}) {
  return (
    <article className="ui-surface ui-panel-soft rounded-[8px] p-3.5 sm:rounded-[10px] sm:p-6">
      <h2 className="font-display text-[1.4rem] font-semibold text-[var(--theme-text-strong)] sm:text-[1.15rem] sm:text-[1.1rem] sm:text-[1.25rem]">{title}</h2>

      {items.length === 0 ? (
        <div className="ui-panel-soft mt-5 rounded-[8px] sm:rounded-[10px] border-dashed px-4 py-8 text-center text-sm text-[var(--theme-text-muted)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <article key={item.key} className="ui-card-soft rounded-[8px] sm:rounded-[10px] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="ui-badge-soft rounded-[10px] px-2.5 py-1 text-xs font-medium">
                      #{index + 1}
                    </span>
                    <h3 className="text-base font-semibold text-[var(--theme-text-strong)]">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--theme-text-muted)]">{item.subtitle}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--theme-text-strong)]">{item.valueLabel}</span>
              </div>

              <div className="mt-4">
                <CompactBar value={item.progress} tone={item.tone} />
              </div>
            </article>
          ))}
        </div>
      )}
    </article>
  );
}

function CompactBar({
  value,
  tone
}: {
  value: number;
  tone: "brand" | "emerald" | "rose";
}) {
  const normalizedValue = Math.min(100, Math.max(0, value)) / 100;

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[var(--theme-surface-soft)] border border-[var(--theme-border-soft)]">
      <div
        className={cx(
          "h-full rounded-full transition-transform duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          tone === "emerald" && "bg-[var(--theme-success-text)]",
          tone === "rose" && "bg-[var(--theme-danger-solid)]",
          tone === "brand" && "bg-[var(--theme-accent)]"
        )}
        style={{
          width: "100%",
          transform: `scaleX(${normalizedValue})`,
          transformOrigin: "left center"
        }}
      />
    </div>
  );
}

function buildConicGradient(segments: DistributionSegment[], total: number) {
  if (!total || segments.every((segment) => segment.value <= 0)) {
    return "conic-gradient(#e2e8f0 0deg 360deg)";
  }

  let currentAngle = 0;

  const stops = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const angle = (segment.value / total) * 360;
      const start = currentAngle;
      currentAngle += angle;
      const end = currentAngle;

      return `${segment.color} ${start}deg ${end}deg`;
    });

  return `conic-gradient(${stops.join(", ")})`;
}
