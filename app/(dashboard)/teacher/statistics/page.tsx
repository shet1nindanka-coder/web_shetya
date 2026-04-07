import Link from "next/link";
import { HomeworkNumberStatus, UserRole } from "@prisma/client";
import { PageHeader } from "@/components/page-header";
import { ProgressBar } from "@/components/progress-bar";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TeacherStatisticsDrilldown } from "@/components/teacher-statistics-drilldown";
import { requireUser } from "@/lib/auth";
import { getTeacherTopicsOverview } from "@/lib/platform-data";
import { completionPercent, cx } from "@/lib/utils";

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

type ReviewStudentSummary = {
  id: string;
  name: string;
  email: string;
  totalRed: number;
  topicCount: number;
  topics: Array<{
    topicId: string;
    title: string;
    numbers: number[];
  }>;
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
  const view = requestedView === "developer" ? "developer" : "teacher";
  const data = await getTeacherTopicsOverview();
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
  const reviewStudentsMap = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      totalRed: number;
      topics: Map<
        string,
        {
          topicId: string;
          title: string;
          numbers: number[];
        }
      >;
    }
  >(
    data.students.map((student) => [
      student.id,
      {
        id: student.id,
        name: student.name,
        email: student.email,
        totalRed: 0,
        topics: new Map()
      }
    ])
  );

  for (const topic of data.topics) {
    for (const number of topic.homeworkNumbers) {
      for (const status of number.statuses) {
        if (status.status !== HomeworkNumberStatus.RED) {
          continue;
        }

        const current = reviewStudentsMap.get(status.studentId);

        if (!current) {
          continue;
        }

        current.totalRed += 1;

        const topicEntry = current.topics.get(topic.id) ?? {
          topicId: topic.id,
          title: topic.title,
          numbers: []
        };

        topicEntry.numbers.push(number.number);
        current.topics.set(topic.id, topicEntry);
      }
    }
  }

  const studentsNeedingReview: ReviewStudentSummary[] = Array.from(reviewStudentsMap.values())
    .filter((student) => student.totalRed > 0)
    .map((student) => ({
      id: student.id,
      name: student.name,
      email: student.email,
      totalRed: student.totalRed,
      topicCount: student.topics.size,
      topics: Array.from(student.topics.values())
        .map((topic) => ({
          ...topic,
          numbers: [...topic.numbers].sort((left, right) => left - right)
        }))
        .sort((left, right) => left.title.localeCompare(right.title, "ru"))
    }))
    .sort((left, right) => right.totalRed - left.totalRed || right.topicCount - left.topicCount);

  const totalGreen = topicAnalytics.reduce((sum, topic) => sum + topic.greenCount, 0);
  const totalYellow = topicAnalytics.reduce((sum, topic) => sum + topic.yellowCount, 0);
  const totalRed = topicAnalytics.reduce((sum, topic) => sum + topic.redCount, 0);
  const totalSolved = totalGreen + totalYellow;
  const totalUnfilled = Math.max(totalStatusSlots - data.stats.totalMarked, 0);
  const activeTopics = topicAnalytics.filter((topic) => topic.studentsWithActivity > 0);
  const activeStudents = studentStats.filter((student) => student.markedCount > 0);
  const totalStudentsNeedingReview = studentsNeedingReview.length;

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
  const quickWinStudents = [...studentStats]
    .filter((student) => student.redCount > 0)
    .sort((left, right) => right.solvedPercent - left.solvedPercent || left.redCount - right.redCount)
    .slice(0, 5);

  const strongestTopic = strongestTopics[0] ?? null;
  const attentionTopic = attentionTopics[0] ?? null;
  const leadStudent = engagedStudents[0] ?? null;
  const firstReviewStudent = studentsNeedingReview[0] ?? null;

  const distributionSegments: DistributionSegment[] = [
    {
      key: "green",
      label: "Зеленые",
      note: "Уверенно решены",
      value: totalGreen,
      color: "#34d399",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900"
    },
    {
      key: "yellow",
      label: "Желтые",
      note: "Исправлены после самопроверки",
      value: totalYellow,
      color: "#fbbf24",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-900"
    },
    {
      key: "red",
      label: "Красные",
      note: "Требуют помощи преподавателя",
      value: totalRed,
      color: "#fb7185",
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-900"
    },
    {
      key: "empty",
      label: "Без статуса",
      note: "Номер еще не отмечен",
      value: totalUnfilled,
      color: "#cbd5e1",
      badgeClassName: "border-slate-200 bg-slate-100 text-slate-700"
    }
  ];

  const activeTopicsPercent = completionPercent(activeTopics.length, data.stats.totalTopics);
  const activeStudentsPercent = completionPercent(activeStudents.length, data.stats.totalStudents);
  const solvedPercent = completionPercent(totalSolved, totalStatusSlots);
  const headlineTitle =
    view === "teacher" ? "Статистика для подготовки к занятиям" : "Общая аналитика платформы";
  const headlineDescription =
    view === "teacher"
      ? "Кого разбирать, где проблемы и что происходит по темам."
      : "Общие метрики и аналитика платформы.";
  const drilldownTopics = data.topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    totalNumbers: topic.totalNumbers,
    homeworkNumbers: topic.homeworkNumbers.map((number) => ({
      id: number.id,
      number: number.number,
      statuses: number.statuses
        .filter((status) => status.status)
        .map((status) => ({
          studentId: status.studentId,
          status: status.status as HomeworkNumberStatus
        }))
    }))
  }));
  const drilldownStudents = data.students.map((student) => ({
    id: student.id,
    name: student.name,
    email: student.email
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Статистика"
        title={headlineTitle}
        description={headlineDescription}
        metrics={[
          { label: "Темы", value: data.stats.totalTopics },
          { label: "Ученики", value: data.stats.totalStudents },
          { label: "Номера", value: data.stats.totalNumbers },
          { label: "Файлы", value: data.stats.totalFiles }
        ]}
        aside={
          <div className="ui-page-header-panel rounded-[18px] p-4 sm:p-5">
            <p className="ui-kicker">{view === "teacher" ? "Главный приоритет" : "Лидер по прогрессу"}</p>
            <p className="mt-2 text-lg font-semibold text-[var(--theme-text-strong)]">
              {view === "teacher"
                ? firstReviewStudent
                  ? firstReviewStudent.name
                  : "Пока без красных"
                : leadStudent
                  ? leadStudent.name
                  : "Пока нет активности"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--theme-text-muted)]">
              {view === "teacher"
                ? firstReviewStudent
                  ? `${firstReviewStudent.totalRed} красных номеров в ${firstReviewStudent.topicCount} темах.`
                  : "Как только появятся красные статусы, здесь будет первый кандидат на разбор."
                : leadStudent
                  ? `${leadStudent.solvedCount} решенных номеров и ${leadStudent.markedCount} отмеченных статусов.`
                  : "Когда появится активность, здесь будет виден ученик с самым сильным прогрессом."}
            </p>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <InsightCard
          label="Лучше всего идет"
          value={strongestTopic ? strongestTopic.title : "Пока нет данных"}
          hint={
            strongestTopic
              ? `${strongestTopic.solvedPercent}% решенных слотов, ${strongestTopic.solvedCount} решенных статусов`
              : "Как только появится активность, здесь покажется самая сильная тема."
          }
        />
        <InsightCard
          label="Больше всего внимания"
          value={attentionTopic ? attentionTopic.title : "Пока без красных"}
          hint={
            attentionTopic
              ? `${attentionTopic.redCount} красных статусов и ${attentionTopic.studentsWithActivity} активных учеников`
              : "Сейчас нет тем, в которых уже накопились красные статусы."
          }
        />
        <InsightCard
          label={view === "teacher" ? "Кому первым нужен разбор" : "Ключевой ученик"}
          value={firstReviewStudent ? firstReviewStudent.name : leadStudent ? leadStudent.name : "Пока нет красных"}
          hint={
            firstReviewStudent
              ? `${firstReviewStudent.totalRed} красных номеров в ${firstReviewStudent.topicCount} темах`
              : leadStudent
                ? `${leadStudent.solvedCount} решенных номеров и ${leadStudent.markedCount} отмеченных статусов`
                : "Когда появятся красные статусы, здесь сразу будет виден главный кандидат на разбор."
          }
        />
      </div>

      <nav className="ui-fade-slide ui-tab-shell ui-tab-strip flex gap-1.5 rounded-[20px] p-1.5 sm:flex-wrap sm:rounded-[22px] sm:p-2">
        {statisticsViews.map((item) => {
          const isActive = item.key === view;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cx("ui-pressable ui-tab shrink-0 rounded-[14px] px-4 py-2.5 text-sm font-medium sm:px-4.5", isActive && "data-[active=true]:shadow-none")}
              data-active={isActive}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {view === "teacher" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Нужен разбор"
              value={totalStudentsNeedingReview}
              accent={<span className="font-semibold text-rose-700">{completionPercent(totalStudentsNeedingReview, data.stats.totalStudents)}% учеников</span>}
            />
            <StatCard
              label="Красные номера"
              value={totalRed}
              accent={<span className="font-semibold text-rose-700">{completionPercent(totalRed, totalStatusSlots)}% от всех слотов</span>}
            />
            <StatCard
              label="Темы с разбором"
              value={attentionTopics.length}
            />
            <StatCard
              label="Быстрые победы"
              value={quickWinStudents.length}
            />
          </div>

          <SectionCard title="Кому нужен разбор сейчас">
            {studentsNeedingReview.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
                <p className="font-display text-2xl font-semibold text-slate-950">Сейчас нет учеников с красными номерами</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {studentsNeedingReview.map((student, index) => (
                  <article
                    key={student.id}
                    className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 sm:rounded-[28px] sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[10px] border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                            #{index + 1}
                          </span>
                          <h2 className="font-display text-[1.35rem] font-semibold text-slate-950 sm:text-[1.5rem]">
                            {student.name}
                          </h2>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {student.totalRed} красных номеров в {student.topicCount}{" "}
                          {student.topicCount === 1 ? "теме" : "темах"}
                        </p>
                      </div>

                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="ui-pressable inline-flex rounded-[14px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        Открыть ученика
                      </Link>
                    </div>

                    <div className="mt-5 space-y-3">
                      {student.topics.map((topic) => (
                        <div key={topic.topicId} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-base font-semibold text-slate-950">{topic.title}</p>
                            <span className="rounded-[10px] border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
                              {topic.numbers.length} красн.
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {topic.numbers.map((number) => (
                              <span
                                key={`${topic.topicId}-${number}`}
                                className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-900"
                              >
                                № {number}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Срез по теме и ученику">
            <TeacherStatisticsDrilldown topics={drilldownTopics} students={drilldownStudents} />
          </SectionCard>

        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Решено"
              value={totalSolved}
              accent={<span className="font-semibold text-emerald-700">{solvedPercent}% от всех слотов</span>}
            />
            <StatCard
              label="Нужна помощь"
              value={totalRed}
              accent={<span className="font-semibold text-rose-700">{completionPercent(totalRed, totalStatusSlots)}% от всех слотов</span>}
            />
            <StatCard
              label="Без статуса"
              value={totalUnfilled}
              accent={<span className="font-semibold text-slate-700">{completionPercent(totalUnfilled, totalStatusSlots)}% от всех слотов</span>}
            />
            <StatCard
              label="Активные ученики"
              value={`${activeStudents.length} / ${data.stats.totalStudents}`}
              accent={<span className="font-semibold text-brand-700">{activeStudentsPercent}% охвата</span>}
            />
          </div>

          <SectionCard title="Как распределяется прогресс">
            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <article className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 sm:rounded-[28px] sm:p-6">
                <div className="flex flex-col items-center gap-6 lg:flex-row">
                  <DonutChart segments={distributionSegments} total={totalStatusSlots} centerValue={`${solvedPercent}%`} centerLabel="решено" />
                  <div className="w-full space-y-3">
                    {distributionSegments.map((segment) => (
                      <div key={segment.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{segment.label}</p>
                              <p className="text-xs leading-5 text-slate-500">{segment.note}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-950">{segment.value}</p>
                            <p className="text-xs text-slate-500">{completionPercent(segment.value, totalStatusSlots)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 sm:rounded-[28px] sm:p-6">
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>Решено уверенно</span>
                      <span className="font-semibold text-slate-950">
                        {totalSolved} / {totalStatusSlots}
                      </span>
                    </div>
                    <ProgressBar value={solvedPercent} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>Темы с активностью</span>
                      <span className="font-semibold text-slate-950">
                        {activeTopics.length} / {data.stats.totalTopics}
                      </span>
                    </div>
                    <ProgressBar value={activeTopicsPercent} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>Ученики в работе</span>
                      <span className="font-semibold text-slate-950">
                        {activeStudents.length} / {data.stats.totalStudents}
                      </span>
                    </div>
                    <ProgressBar value={activeStudentsPercent} />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-slate-500">Ключевой вывод</p>
                    <p className="mt-2 text-base font-semibold text-slate-950">
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
            <div className="grid gap-4 xl:grid-cols-2">
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
            <div className="grid gap-4 xl:grid-cols-2">
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

function InsightCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="ui-surface rounded-[24px] border border-slate-200 bg-white/94 p-4 shadow-[0_10px_22px_rgba(15,23,42,0.04)] sm:rounded-[28px] sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 font-display text-[1.45rem] font-semibold leading-tight text-slate-950 sm:text-[1.6rem]">
        {value}
      </p>
      <p className="ui-hint mt-3 text-sm leading-6 text-slate-600">{hint}</p>
    </article>
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
        className="h-full w-full rounded-full border border-white/70 shadow-inner"
        style={{
          background: backgroundImage
        }}
      />
      <div className="absolute inset-6 rounded-full border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-3xl font-semibold text-slate-950">{centerValue}</span>
        <span className="mt-1 text-sm text-slate-500">{centerLabel}</span>
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
    <article className="ui-surface rounded-[24px] border border-slate-200 bg-slate-50/80 p-5 sm:rounded-[28px] sm:p-6">
      <h2 className="font-display text-[1.4rem] font-semibold text-slate-950 sm:text-[1.55rem]">{title}</h2>

      {items.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-white/80 px-4 py-8 text-center text-sm text-slate-600">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <article key={item.key} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-[10px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                      #{index + 1}
                    </span>
                    <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.subtitle}</p>
                </div>
                <span className="text-sm font-semibold text-slate-950">{item.valueLabel}</span>
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
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90">
      <div
        className={cx(
          "h-full rounded-full transition-transform duration-300 ease-out",
          tone === "emerald" && "bg-emerald-400",
          tone === "rose" && "bg-rose-400",
          tone === "brand" && "bg-brand-500"
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
