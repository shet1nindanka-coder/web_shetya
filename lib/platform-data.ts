import { unstable_cache } from "next/cache";
import { HomeworkNumberStatus, Prisma, UserRole } from "@prisma/client";
import { PLATFORM_DATA_TAGS } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import { completionPercent, getStatusCounts } from "@/lib/utils";

function buildProgress(statuses: Array<HomeworkNumberStatus | null | undefined>, totalNumbers: number) {
  const counts = getStatusCounts(statuses);
  const markedCount = counts.GREEN + counts.YELLOW + counts.RED;

  return {
    greenCount: counts.GREEN,
    yellowCount: counts.YELLOW,
    redCount: counts.RED,
    markedCount,
    totalNumbers,
    progressPercent: completionPercent(markedCount, totalNumbers)
  };
}

function isMissingStudentNotesColumnError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes("note")
  );
}

async function getStudentTopicsOverviewUncached(studentId: string) {
  const [student, topics] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: studentId }
    }),
    prisma.topic.findMany({
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            statuses: {
              where: { studentId },
              select: {
                id: true,
                status: true,
                updatedAt: true
              }
            }
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  const topicCards = topics.map((topic) => {
    const numbers = topic.homeworkNumbers.map((number) => ({
      ...number,
      studentStatus: number.statuses[0] ?? null
    }));
    const summary = buildProgress(
      numbers.map((number) => number.studentStatus?.status ?? null),
      numbers.length
    );

    return {
      ...topic,
      numbers,
      ...summary
    };
  });

  const totalNumbers = topicCards.reduce((sum, topic) => sum + topic.totalNumbers, 0);
  const totalMarked = topicCards.reduce((sum, topic) => sum + topic.markedCount, 0);
  const totalSolved = topicCards.reduce((sum, topic) => sum + topic.greenCount + topic.yellowCount, 0);

  return {
    student,
    topics: topicCards,
    stats: {
      totalTopics: topicCards.length,
      totalGreen: topicCards.reduce((sum, topic) => sum + topic.greenCount, 0),
      totalYellow: topicCards.reduce((sum, topic) => sum + topic.yellowCount, 0),
      totalRed: topicCards.reduce((sum, topic) => sum + topic.redCount, 0),
      totalNumbers,
      totalMarked,
      markedPercent: completionPercent(totalMarked, totalNumbers),
      totalSolved,
      solvedPercent: completionPercent(totalSolved, totalNumbers)
    }
  };
}

const getStudentTopicsOverviewCached = unstable_cache(
  getStudentTopicsOverviewUncached,
  ["student-topics-overview"],
  {
    tags: [PLATFORM_DATA_TAGS.studentTopics]
  }
);

export async function getStudentTopicsOverview(
  studentId: string
): Promise<Awaited<ReturnType<typeof getStudentTopicsOverviewUncached>>> {
  return getStudentTopicsOverviewCached(studentId);
}

async function getStudentTopicDetailUncached(studentId: string, topicId: string) {
  const buildStudentTopicDetailQuery = (includeNote: boolean) =>
    prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            answerFile: true,
            statuses: {
              where: { studentId },
              select: includeNote
                ? {
                    id: true,
                    status: true,
                    note: true,
                    updatedAt: true
                  }
                : {
                    id: true,
                    status: true,
                    updatedAt: true
                  }
            }
          }
        }
      }
  });

  let notesEnabled = true;
  let topic: Awaited<ReturnType<typeof buildStudentTopicDetailQuery>>;

  try {
    topic = await buildStudentTopicDetailQuery(true);
  } catch (error) {
    if (!isMissingStudentNotesColumnError(error)) {
      throw error;
    }

    notesEnabled = false;
    topic = await buildStudentTopicDetailQuery(false);
  }

  const numbers = topic.homeworkNumbers.map((number) => ({
    ...number,
    studentStatus: number.statuses[0]
      ? {
          ...number.statuses[0],
          note: notesEnabled ? (number.statuses[0] as { note?: string | null }).note ?? "" : ""
        }
      : null
  }));
  const progress = buildProgress(
    numbers.map((number) => number.studentStatus?.status ?? null),
    numbers.length
  );

  return {
    ...topic,
    numbers,
    notesEnabled,
    ...progress
  };
}

const getStudentTopicDetailCached = unstable_cache(
  getStudentTopicDetailUncached,
  ["student-topic-detail"],
  {
    tags: [PLATFORM_DATA_TAGS.studentTopics]
  }
);

export async function getStudentTopicDetail(
  studentId: string,
  topicId: string
): Promise<Awaited<ReturnType<typeof getStudentTopicDetailUncached>>> {
  return getStudentTopicDetailCached(studentId, topicId);
}

async function getTeacherTopicsOverviewUncached() {
  const [students, topics, totalFiles] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true
      }
    }),
    prisma.topic.findMany({
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            statuses: true
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.storedFile.count({
      where: {
        OR: [
          {
            theoryForTopics: {
              some: {}
            }
          },
          {
            homeworkForTopics: {
              some: {}
            }
          },
          {
            answerForNumberEntries: {
              some: {}
            }
          }
        ]
      }
    })
  ]);

  const topicCards = topics.map((topic) => {
    const allStatuses = topic.homeworkNumbers.flatMap((number) => number.statuses.map((status) => status.status));
    const counts = getStatusCounts(allStatuses);
    const studentIds = new Set(
      topic.homeworkNumbers.flatMap((number) => number.statuses.map((status) => status.studentId))
    );
    const totalSlots = topic.homeworkNumbers.length * students.length;
    const markedCount = counts.GREEN + counts.YELLOW + counts.RED;

    return {
      ...topic,
      greenCount: counts.GREEN,
      yellowCount: counts.YELLOW,
      redCount: counts.RED,
      markedCount,
      totalStudents: students.length,
      totalNumbers: topic.homeworkNumbers.length,
      totalSlots,
      studentsWithActivity: studentIds.size,
      progressPercent: completionPercent(markedCount, totalSlots)
    };
  });

  return {
    students,
    topics: topicCards,
    stats: {
      totalTopics: topicCards.length,
      totalStudents: students.length,
      totalFiles,
      totalNumbers: topicCards.reduce((sum, topic) => sum + topic.totalNumbers, 0),
      totalMarked: topicCards.reduce((sum, topic) => sum + topic.markedCount, 0)
    }
  };
}

const getTeacherTopicsOverviewCached = unstable_cache(
  getTeacherTopicsOverviewUncached,
  ["teacher-topics-overview"],
  {
    tags: [PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
  }
);

export async function getTeacherTopicsOverview(): Promise<
  Awaited<ReturnType<typeof getTeacherTopicsOverviewUncached>>
> {
  return getTeacherTopicsOverviewCached();
}

async function getTeacherTopicDetailUncached(topicId: string) {
  const buildTeacherTopicDetailQuery = (includeNote: boolean) =>
    prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            answerFile: true,
            statuses: {
              select: includeNote
                ? {
                    id: true,
                    studentId: true,
                    status: true,
                    note: true,
                    updatedAt: true
                  }
                : {
                    id: true,
                    studentId: true,
                    status: true,
                    updatedAt: true
                  }
            }
          }
        }
      }
    });

  const studentsPromise = prisma.user.findMany({
    where: { role: UserRole.STUDENT },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true
    }
  });

  let notesEnabled = true;
  let topic: Awaited<ReturnType<typeof buildTeacherTopicDetailQuery>>;
  const students = await studentsPromise;

  try {
    topic = await buildTeacherTopicDetailQuery(true);
  } catch (error) {
    if (!isMissingStudentNotesColumnError(error)) {
      throw error;
    }

    notesEnabled = false;
    topic = await buildTeacherTopicDetailQuery(false);
  }

  const statusLookup = new Map(
    topic.homeworkNumbers.flatMap((number) =>
      number.statuses.map((status) => [`${status.studentId}:${number.id}`, status] as const)
    )
  );

  const studentProgress = students.map((student) => {
    const numbers = topic.homeworkNumbers.map((number) => {
      const status = statusLookup.get(`${student.id}:${number.id}`) ?? null;

      return {
        id: number.id,
        number: number.number,
        status: status?.status ?? null,
        note: notesEnabled ? (status as { note?: string | null } | null)?.note?.trim() ?? "" : "",
        updatedAt: status?.updatedAt ?? null
      };
    });

    return {
      ...student,
      numbers,
      ...buildProgress(
        numbers.map((number) => number.status),
        numbers.length
      )
    };
  });

  const overallStatuses = studentProgress.flatMap((student) => student.numbers.map((number) => number.status));

  return {
    topic,
    notesEnabled,
    students: studentProgress,
    stats: {
      totalStudents: students.length,
      numbersPerStudent: topic.homeworkNumbers.length,
      ...buildProgress(overallStatuses, topic.homeworkNumbers.length * students.length)
    }
  };
}

const getTeacherTopicDetailCached = unstable_cache(
  getTeacherTopicDetailUncached,
  ["teacher-topic-detail"],
  {
    tags: [PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
  }
);

export async function getTeacherTopicDetail(
  topicId: string
): Promise<Awaited<ReturnType<typeof getTeacherTopicDetailUncached>>> {
  return getTeacherTopicDetailCached(topicId);
}

async function getTeacherStudentDetailUncached(studentId: string) {
  const buildTeacherStudentTopicsQuery = (includeNote: boolean) =>
    prisma.topic.findMany({
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            statuses: {
              where: { studentId },
              select: includeNote
                ? {
                    id: true,
                    status: true,
                    note: true,
                    updatedAt: true
                  }
                : {
                    id: true,
                    status: true,
                    updatedAt: true
                  }
            }
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });

  const studentPromise = prisma.user.findFirstOrThrow({
    where: {
      id: studentId,
      role: UserRole.STUDENT
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });

  let notesEnabled = true;
  let topics: Awaited<ReturnType<typeof buildTeacherStudentTopicsQuery>>;
  const student = await studentPromise;

  try {
    topics = await buildTeacherStudentTopicsQuery(true);
  } catch (error) {
    if (!isMissingStudentNotesColumnError(error)) {
      throw error;
    }

    notesEnabled = false;
    topics = await buildTeacherStudentTopicsQuery(false);
  }

  const topicCards = topics.map((topic) => {
    const numbers = topic.homeworkNumbers.map((number) => ({
      ...number,
      studentStatus: number.statuses[0]
        ? {
            ...number.statuses[0],
            note: notesEnabled ? (number.statuses[0] as { note?: string | null }).note ?? "" : ""
          }
        : null
    }));
    const summary = buildProgress(
      numbers.map((number) => number.studentStatus?.status ?? null),
      numbers.length
    );
    const solvedCount = summary.greenCount + summary.yellowCount;

    return {
      ...topic,
      numbers,
      solvedCount,
      solvedPercent: completionPercent(solvedCount, summary.totalNumbers),
      ...summary
    };
  });

  const totalNumbers = topicCards.reduce((sum, topic) => sum + topic.totalNumbers, 0);
  const totalMarked = topicCards.reduce((sum, topic) => sum + topic.markedCount, 0);
  const totalGreen = topicCards.reduce((sum, topic) => sum + topic.greenCount, 0);
  const totalYellow = topicCards.reduce((sum, topic) => sum + topic.yellowCount, 0);
  const totalRed = topicCards.reduce((sum, topic) => sum + topic.redCount, 0);
  const totalSolved = totalGreen + totalYellow;

  return {
    student,
    notesEnabled,
    topics: topicCards,
    stats: {
      totalTopics: topicCards.length,
      totalNumbers,
      totalMarked,
      totalSolved,
      totalGreen,
      totalYellow,
      totalRed,
      markedPercent: completionPercent(totalMarked, totalNumbers),
      solvedPercent: completionPercent(totalSolved, totalNumbers)
    }
  };
}

const getTeacherStudentDetailCached = unstable_cache(
  getTeacherStudentDetailUncached,
  ["teacher-student-detail"],
  {
    tags: [PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
  }
);

export async function getTeacherStudentDetail(
  studentId: string
): Promise<Awaited<ReturnType<typeof getTeacherStudentDetailUncached>>> {
  return getTeacherStudentDetailCached(studentId);
}

export async function getDashboardSummary(userId: string, role: UserRole) {
  if (role === UserRole.TEACHER) {
    return getTeacherTopicsOverview();
  }

  return getStudentTopicsOverview(userId);
}
