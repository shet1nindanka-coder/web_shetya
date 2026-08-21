import { LessonStatus } from "@prisma/client";
import type { TeacherStatistics, TeacherStatsEntry } from "@/lib/teacher-statistics";

/*
 * Вид «По учителям» в статистике разработчика: кто сколько ведёт учеников,
 * выдал ДЗ, созвонился с родителями и провёл занятий (и когда / на какие темы).
 *
 * Формы графиков — по методике dataviz: сравнение величин — колонки/полосы
 * одним фирменным оттенком (single-hue, категориальная палитра не нужна —
 * CVD-безопасно по построению); текст всегда в текстовых токенах, цвет несут
 * только метки-марки. Серверный компонент, интерактива нет — hover-слой
 * ограничен нативными SVG-тултипами.
 */

const WEEK_LABEL_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });
const LESSON_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow"
});

function pluralRu(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return few;
  }

  return many;
}

function StatTile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.6px]" style={{ color: "var(--shbz-kicker)" }}>
        {label}
      </div>
      <div className="mt-0.5 text-[23px] font-extrabold" style={{ color: "var(--shbz-text-strong)" }}>
        {value}
      </div>
      {note ? (
        <div className="text-[12px]" style={{ color: "var(--shbz-text-muted)" }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Колонки занятий по неделям. Спеки марок: колонка ≤ 24px, скруглён только
 * верхний (данные), у базовой линии — прямой угол; базовая линия — волосок.
 */
function LessonsWeekChart({ counts, weekStarts }: { counts: number[]; weekStarts: string[] }) {
  const width = 660;
  const height = 132;
  const chartTop = 18;
  const chartBottom = height - 26;
  const chartHeight = chartBottom - chartTop;
  const slot = width / counts.length;
  const barWidth = Math.min(24, slot * 0.55);
  const maxCount = Math.max(1, ...counts);

  const columns = counts.map((count, index) => {
    const x = slot * index + (slot - barWidth) / 2;
    const barHeight = count === 0 ? 0 : Math.max(6, (count / maxCount) * chartHeight);
    const y = chartBottom - barHeight;
    const radius = Math.min(4, barWidth / 2, barHeight);
    const weekLabel = WEEK_LABEL_FORMAT.format(new Date(weekStarts[index]));

    // Скруглён только верх колонки: путь от базовой линии, радиус на верхних углах.
    const path =
      barHeight > 0
        ? `M ${x} ${chartBottom} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} H ${x + barWidth - radius} Q ${x + barWidth} ${y} ${x + barWidth} ${y + radius} V ${chartBottom} Z`
        : null;

    return { count, x, y, path, weekLabel, index };
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-[132px] w-full"
      role="img"
      aria-label={`Занятия по неделям: ${columns.map((column) => `${column.weekLabel} — ${column.count}`).join(", ")}`}
    >
      <line x1="0" y1={chartBottom} x2={width} y2={chartBottom} stroke="var(--shbz-soft-border)" strokeWidth="1" />
      {columns.map((column) => (
        <g key={column.index}>
          {column.path ? (
            <path d={column.path} fill="var(--shbz-accent-solid)">
              <title>{`Неделя с ${column.weekLabel}: ${column.count} ${pluralRu(column.count, "занятие", "занятия", "занятий")}`}</title>
            </path>
          ) : null}
          {column.count > 0 ? (
            <text
              x={column.x + barWidth / 2}
              y={column.y - 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--shbz-text-muted)"
            >
              {column.count}
            </text>
          ) : null}
          {column.index % 4 === 0 || column.index === columns.length - 1 ? (
            <text
              x={column.x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize="10.5"
              fill="var(--shbz-kicker)"
            >
              {column.weekLabel}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Горизонтальные полосы «Темы занятий»: заливка — доля от максимума. */
function TopTopics({ topics }: { topics: TeacherStatsEntry["topTopics"] }) {
  const maxCount = Math.max(1, ...topics.map((topic) => topic.count));

  return (
    <div className="space-y-2.5">
      {topics.map((topic) => (
        <div key={topic.title} className="flex items-center gap-3">
          <span className="w-[45%] min-w-0 truncate text-[13px]" style={{ color: "var(--shbz-text-strong)" }}>
            {topic.title}
          </span>
          <span
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--shbz-soft-bg)" }}
            aria-hidden="true"
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${(topic.count / maxCount) * 100}%`, background: "var(--shbz-accent-solid)" }}
            />
          </span>
          <span className="w-6 text-right text-[13px] font-semibold tabular-nums" style={{ color: "var(--shbz-text-muted)" }}>
            {topic.count}
          </span>
        </div>
      ))}
    </div>
  );
}

const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  [LessonStatus.PLANNED]: "запланировано",
  [LessonStatus.ACTIVE]: "идёт сейчас",
  [LessonStatus.FINISHED]: "проведено"
};

function TeacherCard({ entry, weekStarts }: { entry: TeacherStatsEntry; weekStarts: string[] }) {
  return (
    <article className="shbz-card shbz-section-pad">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[17px] font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          {entry.teacherName}
        </h3>
        <span className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
          {entry.teacherEmail}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
        <StatTile label="Ученики" value={entry.studentsCount} />
        <StatTile label="Выдано ДЗ" value={entry.homeworkTotal} note={`за 30 дней: ${entry.homework30d}`} />
        <StatTile
          label="Созвоны с родителями"
          value={entry.callsReached}
          note={entry.callsNoAnswer > 0 ? `недозвонов: ${entry.callsNoAnswer}` : undefined}
        />
        <StatTile label="Занятия" value={entry.lessonsTotal} note={`проведено: ${entry.lessonsFinished}`} />
      </div>

      <div className="mt-7">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
          Занятия по неделям
        </div>
        {entry.lessonsTotal > 0 ? (
          <div className="mt-3">
            <LessonsWeekChart counts={entry.lessonsByWeek} weekStarts={weekStarts} />
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--shbz-text-muted)" }}>
            Занятий пока не было.
          </p>
        )}
      </div>

      {entry.topTopics.length > 0 ? (
        <div className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Темы занятий
          </div>
          <div className="mt-3">
            <TopTopics topics={entry.topTopics} />
          </div>
        </div>
      ) : null}

      {entry.recentLessons.length > 0 ? (
        <div className="mt-7">
          <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
            Последние занятия
          </div>
          <div className="mt-2">
            {entry.recentLessons.map((lesson, index) => (
              <div
                key={lesson.id}
                className="flex flex-col gap-1 py-3 md:flex-row md:items-baseline md:justify-between md:gap-5"
                style={
                  index < entry.recentLessons.length - 1
                    ? { borderBottom: "1px solid var(--shbz-row-border)" }
                    : undefined
                }
              >
                <div className="min-w-0">
                  <span className="text-[14px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                    {LESSON_DATE_FORMAT.format(new Date(lesson.startsAt ?? lesson.createdAt))}
                    {lesson.startsAt ? "" : " (создано)"}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--shbz-text-muted)" }}>
                    {" · "}
                    {lesson.topicTitle ?? lesson.title}
                    {" · "}
                    {lesson.groupName
                      ? `группа «${lesson.groupName}»`
                      : `${lesson.participantsCount} ${pluralRu(lesson.participantsCount, "ученик", "ученика", "учеников")}`}
                  </span>
                </div>
                <span className="shrink-0 text-[13px]" style={{ color: "var(--shbz-text-soft)" }}>
                  {LESSON_STATUS_LABEL[lesson.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function TeacherStatsSection({ statistics }: { statistics: TeacherStatistics }) {
  if (statistics.teachers.length === 0) {
    return (
      <div className="shbz-card px-6 py-10 text-center">
        <p className="text-lg font-bold" style={{ color: "var(--shbz-text-strong)" }}>
          Учителей пока нет
        </p>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-[1.5]" style={{ color: "var(--shbz-text-muted)" }}>
          Когда в системе появятся преподаватели, здесь будет их статистика: ученики, выданные ДЗ,
          созвоны с родителями и занятия.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {statistics.teachers.map((entry) => (
        <TeacherCard key={entry.teacherId} entry={entry} weekStarts={statistics.weekStarts} />
      ))}
    </div>
  );
}
