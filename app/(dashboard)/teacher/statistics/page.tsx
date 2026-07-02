import Link from "next/link";
import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { ProgressTimelineChart } from "@/components/progress-timeline-chart";
import { TeacherProgressTimelineFilter } from "@/components/teacher-progress-timeline-filter";
import { ShbzNumberSearch } from "@/components/shbz-number-search";
import { ShbzPageHeader } from "@/components/shbz-page-header";
import { TeacherStatisticsDrilldown } from "@/components/teacher-statistics-drilldown";
import { requireUser } from "@/lib/auth";
import { getProgressTimeline, getTeacherTopicsOverview } from "@/lib/platform-data";
import { completionPercent, toIsoDateTimeString } from "@/lib/utils";

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
      color: "#36C77E",
      badgeClassName: ""
    },
    {
      key: "yellow",
      label: "Желтые",
      note: "Исправлены после самопроверки",
      value: totalYellow,
      color: "#F2A93B",
      badgeClassName: ""
    },
    {
      key: "red",
      label: "Красные",
      note: "Требуют помощи преподавателя",
      value: totalRed,
      color: "#E5484D",
      badgeClassName: ""
    },
    {
      key: "empty",
      label: "Без статуса",
      note: "Номер еще не отмечен",
      value: totalUnfilled,
      color: "#C7CAD0",
      badgeClassName: ""
    }
  ];

  const activeTopicsPercent = completionPercent(activeTopics.length, data.stats.totalTopics);
  const activeStudentsPercent = completionPercent(activeStudents.length, data.stats.totalStudents);
  const solvedPercent = completionPercent(totalSolved, totalStatusSlots);
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
    <div>
      <ShbzPageHeader
        kicker="Статистика"
        title="Статистика занятий"
        aside={<ShbzNumberSearch endpoint="/api/teacher/topics/find-number" />}
      />

      <nav className="shbz-seg mb-7" aria-label="Режим статистики">
        {statisticsViews.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="shbz-seg-btn shbz-seg-btn--plain"
            data-active={item.key === view}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {view === "teacher" ? (
        <div className="flex flex-col gap-6">
          <section className="shbz-card shbz-section-pad">
            <div className="mb-[22px] flex flex-wrap items-start justify-between gap-6">
              <h2 className="text-xl font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                Динамика прогресса
              </h2>
              <TeacherProgressTimelineFilter
                students={data.students.map((student) => ({
                  id: student.id,
                  name: student.name
                }))}
                selectedStudentId={selectedTimelineStudent?.id ?? ""}
              />
            </div>
            <ProgressTimelineChart
              entries={progressTimelineEntries}
              selectedStudentName={selectedTimelineStudent?.name ?? null}
            />
          </section>

          <section className="shbz-card shbz-section-pad">
            <h2 className="mb-6 text-xl font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Срез по теме и ученику
            </h2>
            <TeacherStatisticsDrilldown topics={drilldownTopics} students={drilldownStudents} />
          </section>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
            <DevMetricCard label="Решено" value={totalSolved} note={`${solvedPercent}% от всех слотов`} noteColor="var(--shbz-green-text)" />
            <DevMetricCard
              label="Нужна помощь"
              value={totalRed}
              note={`${completionPercent(totalRed, totalStatusSlots)}% от всех слотов`}
              noteColor="var(--shbz-red-text)"
            />
            <DevMetricCard
              label="Без статуса"
              value={totalUnfilled}
              note={`${completionPercent(totalUnfilled, totalStatusSlots)}% от всех слотов`}
              noteColor="var(--shbz-text-muted)"
            />
            <DevMetricCard
              label="Активные ученики"
              value={`${activeStudents.length} / ${data.stats.totalStudents}`}
              note={`${activeStudentsPercent}% охвата`}
              noteColor="var(--shbz-accent-solid)"
            />
          </div>

          <section className="shbz-card shbz-section-pad">
            <h2 className="mb-6 text-xl font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Как распределяется прогресс
            </h2>
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="shbz-panel-soft p-6">
                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <DonutChart
                    segments={distributionSegments}
                    total={totalStatusSlots}
                    centerValue={`${solvedPercent}%`}
                    centerLabel="решено"
                  />
                  <div className="w-full space-y-3">
                    {distributionSegments.map((segment) => (
                      <div
                        key={segment.key}
                        className="rounded-2xl border px-4 py-3"
                        style={{ background: "var(--shbz-card-bg)", borderColor: "var(--shbz-soft-border)" }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                            <div>
                              <p className="text-sm font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                                {segment.label}
                              </p>
                              <p className="text-xs leading-5" style={{ color: "var(--shbz-text-muted)" }}>
                                {segment.note}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                              {segment.value}
                            </p>
                            <p className="text-xs" style={{ color: "var(--shbz-text-muted)" }}>
                              {completionPercent(segment.value, totalStatusSlots)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="shbz-panel-soft p-6">
                <div className="space-y-5">
                  <DevProgressRow label="Решено уверенно" value={`${totalSolved} / ${totalStatusSlots}`} percent={solvedPercent} />
                  <DevProgressRow
                    label="Темы с активностью"
                    value={`${activeTopics.length} / ${data.stats.totalTopics}`}
                    percent={activeTopicsPercent}
                  />
                  <DevProgressRow
                    label="Ученики в работе"
                    value={`${activeStudents.length} / ${data.stats.totalStudents}`}
                    percent={activeStudentsPercent}
                  />

                  <div
                    className="rounded-2xl border px-[22px] py-5"
                    style={{ background: "var(--shbz-card-bg)", borderColor: "var(--shbz-soft-border)" }}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
                      Ключевой вывод
                    </div>
                    <p className="mt-2 text-base font-bold leading-normal" style={{ color: "var(--shbz-text-strong)" }}>
                      {totalUnfilled > totalSolved
                        ? "Неотмеченных номеров пока больше, чем реально решенных. Здесь главный резерв роста."
                        : totalRed > 0
                          ? "Основной фокус сейчас не на охвате, а на разборе красных номеров и снятии трудностей."
                          : "Охват уже хороший: можно смещать внимание на качество и скорость прохождения тем."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="shbz-card shbz-section-pad">
            <h2 className="mb-6 text-xl font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Что происходит по темам
            </h2>
            <div className="grid gap-5 xl:grid-cols-2">
              <RankingCard
                title="Лучшее усвоение"
                emptyMessage="Пока нет тем с прогрессом."
                items={strongestTopics.map((topic) => ({
                  key: topic.id,
                  title: topic.title,
                  subtitle: `${topic.solvedCount} решено · ${topic.studentsWithActivity} учеников в работе`,
                  valueLabel: `${topic.solvedPercent}%`,
                  progress: topic.solvedPercent,
                  tone: "emerald" as const
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
                  tone: "rose" as const
                }))}
              />
            </div>
          </section>

          <section className="shbz-card shbz-section-pad">
            <h2 className="mb-6 text-xl font-bold" style={{ color: "var(--shbz-text-strong)" }}>
              Что происходит по ученикам
            </h2>
            <div className="grid gap-5 xl:grid-cols-2">
              <RankingCard
                title="Самые вовлеченные"
                emptyMessage="Пока у учеников нет отмеченных номеров."
                items={engagedStudents.map((student) => ({
                  key: student.id,
                  title: student.name,
                  subtitle: `${student.solvedCount} решено · ${student.markedCount} отмечено`,
                  valueLabel: `${student.solvedPercent}%`,
                  progress: student.solvedPercent,
                  tone: "brand" as const
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
                  tone: "rose" as const
                }))}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function DevMetricCard({
  label,
  value,
  note,
  noteColor
}: {
  label: string;
  value: string | number;
  note: string;
  noteColor: string;
}) {
  return (
    <div className="shbz-panel-soft rounded-[14px] px-5 py-[18px]">
      <div className="text-xs font-semibold" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold leading-tight" style={{ color: "var(--shbz-text-strong)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs font-semibold" style={{ color: noteColor }}>
        {note}
      </div>
    </div>
  );
}

function DevProgressRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold" style={{ color: "var(--shbz-text-muted)" }}>
          {label}
        </span>
        <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
          {value}
        </span>
      </div>
      <div className="shbz-progress-track">
        <div className="shbz-progress-fill" style={{ width: `${percent}%` }} />
      </div>
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
      <div className="h-full w-full rounded-full" style={{ background: backgroundImage }} />
      <div
        className="absolute inset-6 rounded-full border"
        style={{ background: "var(--shbz-card-bg)", borderColor: "var(--shbz-soft-border)" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
          {centerValue}
        </span>
        <span className="mt-1 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          {centerLabel}
        </span>
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
  const toneColors: Record<"brand" | "emerald" | "rose", string> = {
    brand: "var(--shbz-accent-solid)",
    emerald: "#36C77E",
    rose: "var(--shbz-danger-solid)"
  };

  return (
    <div className="shbz-panel-soft p-6">
      <h3 className="text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
        {title}
      </h3>

      {items.length === 0 ? (
        <div className="mt-5 py-6 text-center text-sm" style={{ color: "var(--shbz-text-muted)" }}>
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="rounded-2xl border px-4 py-4"
              style={{ background: "var(--shbz-card-bg)", borderColor: "var(--shbz-soft-border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="shbz-badge-muted" style={{ padding: "4px 10px", fontSize: 12 }}>
                      #{index + 1}
                    </span>
                    <h4 className="text-base font-bold" style={{ color: "var(--shbz-text-strong)" }}>
                      {item.title}
                    </h4>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--shbz-text-muted)" }}>
                    {item.subtitle}
                  </p>
                </div>
                <span className="text-sm font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
                  {item.valueLabel}
                </span>
              </div>

              <div className="shbz-progress-track mt-4">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, item.progress))}%`, background: toneColors[item.tone] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildConicGradient(segments: DistributionSegment[], total: number) {
  if (!total || segments.every((segment) => segment.value <= 0)) {
    return "conic-gradient(var(--shbz-progress-track) 0deg 360deg)";
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
