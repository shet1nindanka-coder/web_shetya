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
 * Каждая сущность считается ровно один раз по первичному ключу — join-путей,
 * способных раздвоить строку, здесь нет. Комментарии звонков в статистику
 * не попадают (персональные данные) — только счётчики.
 *
 * Недели — календарные, от понедельника в таймзоне процесса (Europe/Moscow).
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
  /** Последние занятия — «когда и на какие темы». */
  recentLessons: TeacherLessonEntry[];
  /** Темы занятий по частоте, топ-5. */
  topTopics: Array<{ title: string; count: number }>;
};

export type TeacherStatistics = {
  teachers: TeacherStatsEntry[];
  /** Подписи недель для оси графика (понедельники, от старой к новой). */
  weekStarts: string[];
};

export async function getTeacherStatistics(now = new Date()): Promise<TeacherStatistics> {
  const buckets = buildWeekBuckets(now, TEACHER_STATS_WEEKS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [teachers, students, assignments, callGroups, lessons] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.TEACHER },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      select: { id: true, teacherId: true }
    }),
    // ДЗ атрибутируется владельцу ученика; тонкая выборка без содержимого.
    prisma.homeworkAssignment.findMany({
      select: { createdAt: true, student: { select: { teacherId: true } } }
    }),
    prisma.parentCallLog.groupBy({
      by: ["teacherId", "outcome"],
      _count: { _all: true }
    }),
    prisma.lesson.findMany({
      where: { kind: LessonKind.LESSON },
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
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
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

  const studentOwner = new Map(students.map((student) => [student.id, student.teacherId]));

  for (const teacherId of studentOwner.values()) {
    const entry = teacherId ? entries.get(teacherId) : undefined;

    if (entry) {
      entry.studentsCount += 1;
    }
  }

  for (const assignment of assignments) {
    const entry = assignment.student.teacherId ? entries.get(assignment.student.teacherId) : undefined;

    if (!entry) {
      continue;
    }

    entry.homeworkTotal += 1;

    if (assignment.createdAt.getTime() >= since30d.getTime()) {
      entry.homework30d += 1;
    }
  }

  for (const group of callGroups) {
    const entry = group.teacherId ? entries.get(group.teacherId) : undefined;

    if (!entry) {
      continue;
    }

    if (group.outcome === ParentCallOutcome.REACHED) {
      entry.callsReached += group._count._all;
    } else {
      entry.callsNoAnswer += group._count._all;
    }
  }

  const lessonDatesByTeacher = new Map<string, Date[]>();
  const topicCountsByTeacher = new Map<string, Map<string, number>>();

  for (const lesson of lessons) {
    const entry = entries.get(lesson.teacherId);

    if (!entry) {
      continue;
    }

    entry.lessonsTotal += 1;

    if (lesson.status === LessonStatus.FINISHED) {
      entry.lessonsFinished += 1;
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

    if (entry.recentLessons.length < TEACHER_STATS_RECENT_LESSONS) {
      entry.recentLessons.push({
        id: lesson.id,
        title: lesson.title,
        topicTitle: lesson.topic?.title ?? null,
        groupName: lesson.group?.name ?? null,
        participantsCount: lesson._count.participants,
        startsAt: lesson.startsAt ? lesson.startsAt.toISOString() : null,
        createdAt: lesson.createdAt.toISOString(),
        status: lesson.status
      });
    }
  }

  for (const entry of entries.values()) {
    entry.lessonsByWeek = countByWeek(lessonDatesByTeacher.get(entry.teacherId) ?? [], buckets);
    entry.topTopics = [...(topicCountsByTeacher.get(entry.teacherId) ?? new Map<string, number>())]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ru"))
      .slice(0, 5);
  }

  return {
    teachers: [...entries.values()],
    weekStarts: buckets.map((bucket) => bucket.start.toISOString())
  };
}
