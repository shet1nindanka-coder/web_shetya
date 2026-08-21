import { LessonKind, LessonStatus, ParentCallOutcome, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildWeekBuckets, countByWeek } from "@/lib/week-buckets";

/*
 * Статистика по учителям для роли «разработчик» (/teacher/statistics?view=teachers).
 *
 * Атрибуция (см. Decisions log фазы 3):
 * - ученики и выданные ДЗ — по владельцу ученика (User.teacherId): у ДЗ нет
 *   собственного поля учителя, владелец — единственный честный источник;
 * - созвоны — по ParentCallLog.teacherId (кто реально звонил);
 * - занятия — по Lesson.teacherId (kind=LESSON; черновики ДЗ не считаются).
 *
 * Сущности, которые ни к одному учителю не относятся (ученики без владельца,
 * звонки удалённых учителей после SetNull, уроки, созданные разработчиком),
 * не теряются молча — они суммируются в `unattributed` и показываются отдельной
 * строкой. Комментарии звонков в статистику не попадают (персональные данные).
 *
 * Счётчики считаются агрегатами в БД (groupBy/_count); строки уроков грузятся
 * только за окно графика (12 недель) — для колонок, тем и «последних занятий».
 *
 * Недели — календарные, от понедельника в таймзоне процесса. Как и стрики с
 * дедлайнами, расчёт опирается на системный инвариант TZ=Europe/Moscow.
 */

export const TEACHER_STATS_WEEKS = 12;
export const TEACHER_STATS_RECENT_LESSONS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TeacherLessonEntry = {
  id: string;
  title: string;
  topicTitle: string | null;
  groupName: string | null;
  participantsCount: number;
  startsAt: string | null;
  createdAt: string;
  status: LessonStatus;
};

export type TeacherStatsEntry = {
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  studentsCount: number;
  homeworkTotal: number;
  homework30d: number;
  callsReached: number;
  callsNoAnswer: number;
  lessonsTotal: number;
  lessonsFinished: number;
  /** Занятия по неделям (последние TEACHER_STATS_WEEKS, от старой к новой). */
  lessonsByWeek: number[];
  /** Прошедшие занятия окна, новые сверху — «когда и на какие темы». */
  recentLessons: TeacherLessonEntry[];
  /** Темы занятий окна по частоте, топ-5. */
  topTopics: Array<{ title: string; count: number }>;
};

export type TeacherStatistics = {
  teachers: TeacherStatsEntry[];
  /** Подписи недель для оси графика (понедельники, от старой к новой). */
  weekStarts: string[];
  /** Не привязанное ни к одному учителю — чтобы суммы не расходились молча. */
  unattributed: {
    students: number;
    homework: number;
    calls: number;
    lessons: number;
  };
};

export async function getTeacherStatistics(now = new Date()): Promise<TeacherStatistics> {
  const buckets = buildWeekBuckets(now, TEACHER_STATS_WEEKS);
  const windowStart = buckets[0].start;
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [teachers, students, homeworkByStudent, homework30dByStudent, callGroups, lessonGroups, windowLessons] =
    await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.TEACHER },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" }
      }),
      prisma.user.findMany({
        where: { role: UserRole.STUDENT },
        select: { id: true, teacherId: true }
      }),
      prisma.homeworkAssignment.groupBy({ by: ["studentId"], _count: { _all: true } }),
      prisma.homeworkAssignment.groupBy({
        by: ["studentId"],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true }
      }),
      prisma.parentCallLog.groupBy({
        by: ["teacherId", "outcome"],
        _count: { _all: true }
      }),
      prisma.lesson.groupBy({
        by: ["teacherId", "status"],
        where: { kind: LessonKind.LESSON },
        _count: { _all: true }
      }),
      // Строки нужны только для окна графика: колонки, темы, «последние занятия».
      prisma.lesson.findMany({
        where: {
          kind: LessonKind.LESSON,
          OR: [{ startsAt: { gte: windowStart } }, { startsAt: null, createdAt: { gte: windowStart } }]
        },
        select: {
          id: true,
          title: true,
          teacherId: true,
          status: true,
          startsAt: true,
          createdAt: true,
          topic: { select: { title: true } },
          group: { select: { name: true } },
          _count: { select: { participants: true } }
        }
      })
    ]);

  const entries = new Map<string, TeacherStatsEntry>(
    teachers.map((teacher) => [
      teacher.id,
      {
        teacherId: teacher.id,
        teacherName: teacher.name,
        teacherEmail: teacher.email,
        studentsCount: 0,
        homeworkTotal: 0,
        homework30d: 0,
        callsReached: 0,
        callsNoAnswer: 0,
        lessonsTotal: 0,
        lessonsFinished: 0,
        lessonsByWeek: buckets.map(() => 0),
        recentLessons: [],
        topTopics: []
      }
    ])
  );

  const unattributed = { students: 0, homework: 0, calls: 0, lessons: 0 };
  const studentOwner = new Map(students.map((student) => [student.id, student.teacherId]));

  for (const teacherId of studentOwner.values()) {
    const entry = teacherId ? entries.get(teacherId) : undefined;

    if (entry) {
      entry.studentsCount += 1;
    } else {
      unattributed.students += 1;
    }
  }

  const addHomework = (byStudent: Array<{ studentId: string; _count: { _all: number } }>, field: "homeworkTotal" | "homework30d") => {
    for (const group of byStudent) {
      const teacherId = studentOwner.get(group.studentId) ?? null;
      const entry = teacherId ? entries.get(teacherId) : undefined;

      if (entry) {
        entry[field] += group._count._all;
      } else if (field === "homeworkTotal") {
        unattributed.homework += group._count._all;
      }
    }
  };

  addHomework(homeworkByStudent, "homeworkTotal");
  addHomework(homework30dByStudent, "homework30d");

  for (const group of callGroups) {
    const entry = group.teacherId ? entries.get(group.teacherId) : undefined;

    if (!entry) {
      unattributed.calls += group._count._all;
      continue;
    }

    if (group.outcome === ParentCallOutcome.REACHED) {
      entry.callsReached += group._count._all;
    } else {
      entry.callsNoAnswer += group._count._all;
    }
  }

  for (const group of lessonGroups) {
    const entry = entries.get(group.teacherId);

    if (!entry) {
      // Уроки, созданные не-учителем (разработчиком) — не теряем молча.
      unattributed.lessons += group._count._all;
      continue;
    }

    entry.lessonsTotal += group._count._all;

    if (group.status === LessonStatus.FINISHED) {
      entry.lessonsFinished += group._count._all;
    }
  }

  const lessonDatesByTeacher = new Map<string, Date[]>();
  const topicCountsByTeacher = new Map<string, Map<string, number>>();
  const windowLessonsByTeacher = new Map<string, typeof windowLessons>();

  for (const lesson of windowLessons) {
    if (!entries.has(lesson.teacherId)) {
      continue;
    }

    // «Когда было занятие» — заявленное время урока, иначе момент создания.
    const happenedAt = lesson.startsAt ?? lesson.createdAt;
    const dates = lessonDatesByTeacher.get(lesson.teacherId) ?? [];
    dates.push(happenedAt);
    lessonDatesByTeacher.set(lesson.teacherId, dates);

    if (lesson.topic?.title) {
      const topicCounts = topicCountsByTeacher.get(lesson.teacherId) ?? new Map<string, number>();
      topicCounts.set(lesson.topic.title, (topicCounts.get(lesson.topic.title) ?? 0) + 1);
      topicCountsByTeacher.set(lesson.teacherId, topicCounts);
    }

    const list = windowLessonsByTeacher.get(lesson.teacherId) ?? [];
    list.push(lesson);
    windowLessonsByTeacher.set(lesson.teacherId, list);
  }

  const nowMs = now.getTime();

  for (const entry of entries.values()) {
    entry.lessonsByWeek = countByWeek(lessonDatesByTeacher.get(entry.teacherId) ?? [], buckets);
    entry.topTopics = [...(topicCountsByTeacher.get(entry.teacherId) ?? new Map<string, number>())]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ru"))
      .slice(0, 5);

    // «Последние занятия» — уже случившиеся, по отображаемой дате (не по createdAt):
    // созданный давно, но прошедший вчера урок стоит выше свежего черновика.
    entry.recentLessons = (windowLessonsByTeacher.get(entry.teacherId) ?? [])
      .filter((lesson) => (lesson.startsAt ?? lesson.createdAt).getTime() <= nowMs)
      .sort(
        (a, b) => (b.startsAt ?? b.createdAt).getTime() - (a.startsAt ?? a.createdAt).getTime() || b.id.localeCompare(a.id)
      )
      .slice(0, TEACHER_STATS_RECENT_LESSONS)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        topicTitle: lesson.topic?.title ?? null,
        groupName: lesson.group?.name ?? null,
        participantsCount: lesson._count.participants,
        startsAt: lesson.startsAt ? lesson.startsAt.toISOString() : null,
        createdAt: lesson.createdAt.toISOString(),
        status: lesson.status
      }));
  }

  return {
    teachers: [...entries.values()],
    weekStarts: buckets.map((bucket) => bucket.start.toISOString()),
    unattributed
  };
}
