import { unstable_cache } from "next/cache";
import {
  HomeworkNumberStatus,
  LessonItemResult,
  LessonKind,
  Prisma,
  SolutionCheckStatus,
  SolutionVerdict,
  UserRole
} from "@prisma/client";
import { logWarnEvent } from "@/lib/logger";
import { PLATFORM_DATA_TAGS } from "@/lib/platform-data-cache";
import { prisma } from "@/lib/prisma";
import type { TimelineEntry } from "@/lib/progress-timeline";
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

function isMissingStudentStatusColumnError(error: unknown, column: "note" | "deadlineAt") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("StudentTopicNumberStatus") &&
    error.message.includes(column)
  );
}

function isMissingHomeworkNumberColumnError(error: unknown, column: "answerLatex" | "conditionLatex") {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022" &&
    error.message.includes("TopicHomeworkNumber") &&
    error.message.includes(column)
  );
}

function isRecoverablePlatformDataError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

async function resolveTopicDataCapabilities<T>(
  queryBuilder: (capabilities: {
    notesEnabled: boolean;
    deadlinesEnabled: boolean;
    answerLatexEnabled: boolean;
    conditionLatexEnabled: boolean;
  }) => Promise<T>
) {
  let capabilities: {
    notesEnabled: boolean;
    deadlinesEnabled: boolean;
    answerLatexEnabled: boolean;
    conditionLatexEnabled: boolean;
  } = {
    notesEnabled: true,
    deadlinesEnabled: true,
    answerLatexEnabled: true,
    conditionLatexEnabled: true
  };

  while (true) {
    try {
      const result = await queryBuilder(capabilities);

      return {
        ...capabilities,
        result
      };
    } catch (error) {
      const noteMissing = isMissingStudentStatusColumnError(error, "note");
      const deadlineMissing = isMissingStudentStatusColumnError(error, "deadlineAt");
      const answerLatexMissing = isMissingHomeworkNumberColumnError(error, "answerLatex");
      const conditionLatexMissing = isMissingHomeworkNumberColumnError(error, "conditionLatex");

      if (!noteMissing && !deadlineMissing && !answerLatexMissing && !conditionLatexMissing) {
        throw error;
      }

      const nextCapabilities = {
        notesEnabled: capabilities.notesEnabled && !noteMissing,
        deadlinesEnabled: capabilities.deadlinesEnabled && !deadlineMissing,
        answerLatexEnabled: capabilities.answerLatexEnabled && !answerLatexMissing,
        conditionLatexEnabled: capabilities.conditionLatexEnabled && !conditionLatexMissing
      };

      const didChange =
        nextCapabilities.notesEnabled !== capabilities.notesEnabled ||
        nextCapabilities.deadlinesEnabled !== capabilities.deadlinesEnabled ||
        nextCapabilities.answerLatexEnabled !== capabilities.answerLatexEnabled ||
        nextCapabilities.conditionLatexEnabled !== capabilities.conditionLatexEnabled;

      if (!didChange) {
        throw error;
      }

      capabilities = nextCapabilities;
    }
  }
}

async function getStudentTopicsOverviewUncached(studentId: string) {
  const [student, topics] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: studentId }
    }),
    prisma.topic.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        displayOrder: true,
        theoryFileId: true,
        homeworkFileId: true,
        createdAt: true,
        updatedAt: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
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
      theoryFile: topic.theoryFileId ? { id: topic.theoryFileId } : null,
      homeworkFile: topic.homeworkFileId ? { id: topic.homeworkFileId } : null,
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

const getStudentTopicsOverviewCached = unstable_cache(getStudentTopicsOverviewUncached, ["student-topics-overview"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics]
});

export async function getStudentTopicsOverview(
  studentId: string
): Promise<Awaited<ReturnType<typeof getStudentTopicsOverviewUncached>>> {
  try {
    return await getStudentTopicsOverviewCached(studentId);
  } catch (error) {
    if (!isRecoverablePlatformDataError(error)) {
      throw error;
    }

    logWarnEvent(
      "platform.student_topics.schema_mismatch_fallback",
      { studentId },
      error,
      "Falling back to minimal student topics overview due to Prisma schema mismatch."
    );

    const [student, topics] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: studentId }
      }),
      prisma.topic.findMany({
        select: {
          id: true,
          title: true,
          description: true,
          subject: true,
          grade: true,
          displayOrder: true,
          theoryFileId: true,
          homeworkFileId: true,
          createdAt: true,
          updatedAt: true,
          homeworkNumbers: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              number: true,
              displayOrder: true,
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
        theoryFile: topic.theoryFileId ? { id: topic.theoryFileId } : null,
        homeworkFile: topic.homeworkFileId ? { id: topic.homeworkFileId } : null,
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
}

async function getStudentTopicDetailUncached(studentId: string, topicId: string) {
  const buildStudentTopicDetailQuery = ({
    notesEnabled,
    deadlinesEnabled,
    answerLatexEnabled,
    conditionLatexEnabled
  }: {
    notesEnabled: boolean;
    deadlinesEnabled: boolean;
    answerLatexEnabled: boolean;
    conditionLatexEnabled: boolean;
  }) =>
    prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        theoryFile: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            uploadedAt: true
          }
        },
        homeworkFile: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            uploadedAt: true
          }
        },
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
            ...(conditionLatexEnabled ? { conditionLatex: true } : {}),
            ...(answerLatexEnabled ? { answerLatex: true } : {}),
            statuses: {
              where: { studentId },
              select: {
                id: true,
                status: true,
                ...(notesEnabled ? { note: true } : {}),
                ...(deadlinesEnabled ? { deadlineAt: true } : {}),
                updatedAt: true
              }
            }
          }
        }
      }
  });

  const {
    result: topic,
    notesEnabled,
    deadlinesEnabled,
    answerLatexEnabled,
    conditionLatexEnabled
  } = await resolveTopicDataCapabilities(buildStudentTopicDetailQuery);

  const numbers = topic.homeworkNumbers.map((number) => ({
    ...number,
    studentStatus: number.statuses[0]
      ? {
          ...number.statuses[0],
          note: notesEnabled ? (number.statuses[0] as { note?: string | null }).note ?? "" : "",
          deadlineAt: deadlinesEnabled
            ? (number.statuses[0] as { deadlineAt?: Date | null }).deadlineAt ?? null
            : null
        }
      : null,
    conditionLatex: conditionLatexEnabled ? (number as { conditionLatex?: string | null }).conditionLatex ?? null : null,
    answerLatex: answerLatexEnabled ? (number as { answerLatex?: string | null }).answerLatex ?? null : null
  }));
  const progress = buildProgress(
    numbers.map((number) => number.studentStatus?.status ?? null),
    numbers.length
  );

  return {
    ...topic,
    numbers,
    notesEnabled,
    deadlinesEnabled,
    answerLatexEnabled,
    conditionLatexEnabled,
    ...progress
  };
}

const getStudentTopicDetailCached = unstable_cache(getStudentTopicDetailUncached, ["student-topic-detail"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics]
});

export async function getStudentTopicDetail(
  studentId: string,
  topicId: string
): Promise<Awaited<ReturnType<typeof getStudentTopicDetailUncached>>> {
  try {
    return await getStudentTopicDetailCached(studentId, topicId);
  } catch (error) {
    if (!isRecoverablePlatformDataError(error)) {
      throw error;
    }

    logWarnEvent(
      "platform.student_topic_detail.schema_mismatch_fallback",
      { studentId, topicId },
      error,
      "Falling back to minimal student topic detail due to Prisma schema mismatch."
    );

    const topic = await prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      select: {
        id: true,
        title: true,
        description: true,
        subject: true,
        grade: true,
        displayOrder: true,
        theoryFileId: true,
        homeworkFileId: true,
        createdAt: true,
        updatedAt: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
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
      }
    });

    const normalizedHomeworkNumbers = topic.homeworkNumbers.map((number) => {
      const normalizedStatuses = number.statuses.map((status) => ({
        ...status,
        note: null,
        deadlineAt: null
      }));

      return {
        ...number,
        statuses: normalizedStatuses,
        conditionLatex: null,
        answerLatex: null
      };
    });

    const numbers = normalizedHomeworkNumbers.map((number) => {
      return {
        ...number,
        studentStatus: number.statuses[0]
          ? {
              ...number.statuses[0],
              note: "",
              deadlineAt: null
            }
          : null,
        conditionLatex: null,
        answerLatex: null
      };
    });
    const progress = buildProgress(
      numbers.map((number) => number.studentStatus?.status ?? null),
      numbers.length
    );

    return {
      ...topic,
      theoryFile: null,
      homeworkFile: null,
      homeworkNumbers: normalizedHomeworkNumbers,
      numbers,
      notesEnabled: false,
      deadlinesEnabled: false,
      conditionLatexEnabled: false,
      answerLatexEnabled: false,
      ...progress
    };
  }
}

async function getTeacherTopicsOverviewUncached() {
  const [students, topicsResult, totalFiles] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true
      }
    }),
    resolveTopicDataCapabilities(({ deadlinesEnabled }) =>
      prisma.topic.findMany({
        include: {
          theoryFile: true,
          homeworkFile: true,
          homeworkNumbers: {
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              number: true,
              displayOrder: true,
              statuses: {
                select: {
                  studentId: true,
                  status: true,
                  updatedAt: true,
                  ...(deadlinesEnabled ? { deadlineAt: true } : {})
                }
              }
            }
          }
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
      })
    ),
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
  const { result: topics, deadlinesEnabled } = topicsResult;

  const topicCards = topics.map((topic) => {
    const allStatuses = topic.homeworkNumbers.flatMap((number) => number.statuses.map((status) => status.status));
    const counts = getStatusCounts(allStatuses);
    const studentIds = new Set(
      topic.homeworkNumbers.flatMap((number) =>
        number.statuses.filter((status) => status.status !== null).map((status) => status.studentId)
      )
    );
    const totalSlots = topic.homeworkNumbers.length * students.length;
    const markedCount = counts.GREEN + counts.YELLOW + counts.RED;

    return {
      ...topic,
      homeworkNumbers: topic.homeworkNumbers.map((number) => ({
        ...number,
        statuses: number.statuses.map((status) => ({
          ...status,
          deadlineAt: deadlinesEnabled
            ? (status as { deadlineAt?: Date | null }).deadlineAt ?? null
            : null
        }))
      })),
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
  const buildTeacherTopicDetailQuery = ({
    answerLatexEnabled,
    conditionLatexEnabled
  }: {
    notesEnabled: boolean;
    deadlinesEnabled: boolean;
    answerLatexEnabled: boolean;
    conditionLatexEnabled: boolean;
  }) =>
    prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        theoryFile: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            uploadedAt: true
          }
        },
        homeworkFile: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            uploadedAt: true
          }
        },
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
            difficulty: true,
            estimatedMinutes: true,
            difficultySource: true,
            ...(conditionLatexEnabled ? { conditionLatex: true } : {}),
            ...(answerLatexEnabled ? { answerLatex: true } : {})
          }
        }
      }
    });

  const { result: topic, answerLatexEnabled, conditionLatexEnabled } = await resolveTopicDataCapabilities(buildTeacherTopicDetailQuery);

  const normalizedTopic = {
    ...topic,
    homeworkNumbers: topic.homeworkNumbers.map((number) => ({
      ...number,
      conditionLatex: conditionLatexEnabled ? (number as { conditionLatex?: string | null }).conditionLatex ?? null : null,
      answerLatex: answerLatexEnabled ? (number as { answerLatex?: string | null }).answerLatex ?? null : null
    }))
  };

  return {
    topic: normalizedTopic,
    stats: {
      totalNumbers: normalizedTopic.homeworkNumbers.length,
      theoryAttached: Boolean(normalizedTopic.theoryFile),
      homeworkAttached: Boolean(normalizedTopic.homeworkFile),
      conditionsCount: normalizedTopic.homeworkNumbers.filter((number) => Boolean(number.conditionLatex?.trim())).length,
      answersCount: normalizedTopic.homeworkNumbers.filter((number) => Boolean(number.answerLatex?.trim())).length
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
  const buildTeacherStudentTopicsQuery = ({
    notesEnabled,
    deadlinesEnabled,
    answerLatexEnabled
  }: {
    notesEnabled: boolean;
    deadlinesEnabled: boolean;
    answerLatexEnabled: boolean;
  }) =>
    prisma.topic.findMany({
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
            statuses: {
              where: { studentId },
              select: {
                id: true,
                status: true,
                ...(notesEnabled ? { note: true } : {}),
                ...(deadlinesEnabled ? { deadlineAt: true } : {}),
                updatedAt: true
              }
            }
          }
        }
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
    });

  const student = await prisma.user.findFirst({
    where: { id: studentId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true
    }
  });

  if (!student) {
    logWarnEvent(
      "platform.teacher_student_detail.missing",
      {
        studentId
      },
      undefined,
      "Teacher student detail was requested for a missing student."
    );
    throw new Error(`Student not found: ${studentId}`);
  }
  const {
    result: topics,
    notesEnabled,
    deadlinesEnabled
  } = await resolveTopicDataCapabilities(buildTeacherStudentTopicsQuery);

  const topicCards = topics.map((topic) => {
    const numbers = topic.homeworkNumbers.map((number) => ({
      ...number,
      studentStatus: number.statuses[0]
        ? {
            ...number.statuses[0],
            note: notesEnabled ? (number.statuses[0] as { note?: string | null }).note ?? "" : "",
            deadlineAt: deadlinesEnabled
              ? (number.statuses[0] as { deadlineAt?: Date | null }).deadlineAt ?? null
              : null
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
    deadlinesEnabled,
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

const getTeacherStudentDetailCached = unstable_cache(getTeacherStudentDetailUncached, ["teacher-student-detail"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
});

export async function getTeacherStudentDetail(
  studentId: string
): Promise<Awaited<ReturnType<typeof getTeacherStudentDetailUncached>>> {
  return getTeacherStudentDetailCached(studentId);
}


// ── Student Deadlines ─────────────────────────────

async function getStudentDeadlinesUncached(studentId: string) {
  const statuses = await prisma.studentTopicNumberStatus.findMany({
    where: {
      studentId,
      deadlineAt: { not: null }
    },
    select: {
      id: true,
      status: true,
      deadlineAt: true,
      homeworkNumber: {
        select: {
          id: true,
          number: true,
          topic: {
            select: {
              id: true,
              title: true
            }
          }
        }
      }
    },
    orderBy: { deadlineAt: "asc" }
  });

  return statuses.map((s) => ({
    id: s.id,
    deadlineAt: s.deadlineAt!,
    status: s.status,
    homeworkNumberId: s.homeworkNumber.id,
    homeworkNumber: s.homeworkNumber.number,
    topicId: s.homeworkNumber.topic.id,
    topicTitle: s.homeworkNumber.topic.title
  }));
}

const getStudentDeadlinesCached = unstable_cache(getStudentDeadlinesUncached, ["student-deadlines"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
});

export async function getStudentDeadlines(studentId: string) {
  try {
    return await getStudentDeadlinesCached(studentId);
  } catch (error) {
    if (!isRecoverablePlatformDataError(error)) {
      throw error;
    }

    logWarnEvent(
      "platform.student_deadlines.schema_mismatch_fallback",
      { studentId },
      error,
      "Falling back to empty student deadlines due to Prisma schema mismatch."
    );

    return [];
  }
}

export type StudentDeadline = Awaited<ReturnType<typeof getStudentDeadlines>>[number];

async function getProgressTimelineUncached(studentId: string | null, days: number): Promise<TimelineEntry[]> {
  const normalizedDays = Math.max(1, Math.min(112, Math.floor(days)));
  const today = startOfTimelineDay(new Date());
  const timelineStart = addTimelineDays(today, -(normalizedDays - 1));

  try {
    const statuses = await prisma.studentTopicNumberStatus.findMany({
      where: {
        status: {
          in: [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED]
        },
        ...(studentId ? { studentId } : {}),
        // Опираемся на statusChangedAt (когда статус реально менялся), а не на
        // updatedAt, который бампается зеркалированием дедлайна. Для строк без
        // statusChangedAt (до бэкфилла) откатываемся на updatedAt.
        OR: [
          { statusChangedAt: { gte: timelineStart } },
          { statusChangedAt: null, updatedAt: { gte: timelineStart } }
        ]
      },
      select: {
        status: true,
        updatedAt: true,
        statusChangedAt: true
      },
      orderBy: { updatedAt: "asc" }
    });

    const grouped = new Map<string, TimelineEntry>();

    for (let index = 0; index < normalizedDays; index += 1) {
      const currentDate = addTimelineDays(timelineStart, index);
      const key = getTimelineDateKey(currentDate);

      grouped.set(key, {
        date: key,
        closedCount: 0,
        redCount: 0
      });
    }

    for (const status of statuses) {
      const key = getTimelineDateKey(status.statusChangedAt ?? status.updatedAt);
      const current = grouped.get(key);

      if (!current) {
        continue;
      }

      if (status.status === HomeworkNumberStatus.RED) {
        current.redCount += 1;
      } else {
        current.closedCount += 1;
      }
    }

    return Array.from(grouped.values());
  } catch (error) {
    if (!isRecoverablePlatformDataError(error)) {
      throw error;
    }

    logWarnEvent(
      "platform.progress_timeline.schema_mismatch_fallback",
      { studentId: studentId ?? null, days: normalizedDays },
      error,
      "Falling back to empty progress timeline due to Prisma schema mismatch."
    );

    return Array.from({ length: normalizedDays }, (_, index) => {
      const currentDate = addTimelineDays(timelineStart, index);

      return {
        date: getTimelineDateKey(currentDate),
        closedCount: 0,
        redCount: 0
      };
    });
  }
}

const getProgressTimelineCached = unstable_cache(getProgressTimelineUncached, ["progress-timeline"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents],
  revalidate: 300
});

export async function getProgressTimeline(studentId?: string, days = 112): Promise<TimelineEntry[]> {
  return getProgressTimelineCached(studentId ?? null, days);
}

export async function getDashboardSummary(userId: string, role: UserRole) {
  if (role === UserRole.TEACHER) {
    return getTeacherTopicsOverview();
  }

  return getStudentTopicsOverview(userId);
}

export async function getStudentNumberDetail(studentId: string, topicId: string, targetNumber: number) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      description: true
    }
  });

  let homeworkNumber;

  try {
    homeworkNumber = await prisma.topicHomeworkNumber.findFirstOrThrow({
      where: { topicId, number: targetNumber },
      select: {
        id: true,
        number: true,
        conditionLatex: true,
        answerLatex: true,
        statuses: {
          where: { studentId },
          select: {
            id: true,
            status: true,
            note: true,
            deadlineAt: true,
            updatedAt: true
          }
        }
      }
    });
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      homeworkNumber = await prisma.topicHomeworkNumber.findFirstOrThrow({
        where: { topicId, number: targetNumber },
        select: {
          id: true,
          number: true,
          statuses: {
            where: { studentId },
            select: {
              id: true,
              status: true,
              updatedAt: true
            }
          }
        }
      });

      const rawStatus = homeworkNumber.statuses[0] ?? null;

      return {
        topic,
        number: {
          id: homeworkNumber.id,
          number: homeworkNumber.number,
          conditionLatex: null as string | null,
          answerLatex: null as string | null,
          studentStatus: rawStatus
            ? { ...rawStatus, note: "" as string, deadlineAt: null as Date | null }
            : null
        },
        notesEnabled: false,
        deadlinesEnabled: false
      };
    }

    throw error;
  }

  const rawStatus = homeworkNumber.statuses[0] ?? null;

  return {
    topic,
    number: {
      id: homeworkNumber.id,
      number: homeworkNumber.number,
      conditionLatex: (homeworkNumber as { conditionLatex?: string | null }).conditionLatex ?? null,
      answerLatex: (homeworkNumber as { answerLatex?: string | null }).answerLatex ?? null,
      studentStatus: rawStatus
        ? {
            ...rawStatus,
            note: (rawStatus as { note?: string | null }).note ?? "",
            deadlineAt: (rawStatus as { deadlineAt?: Date | null }).deadlineAt ?? null
          }
        : null
    },
    notesEnabled: true,
    deadlinesEnabled: true
  };
}

export async function getTeacherNumberDetail(topicId: string, targetNumber: number) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      description: true
    }
  });

  let homeworkNumber;

  try {
    homeworkNumber = await prisma.topicHomeworkNumber.findFirstOrThrow({
      where: { topicId, number: targetNumber },
      select: {
        id: true,
        number: true,
        conditionLatex: true,
        answerLatex: true
      }
    });
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      const minimal = await prisma.topicHomeworkNumber.findFirstOrThrow({
        where: { topicId, number: targetNumber },
        select: {
          id: true,
          number: true
        }
      });

      return {
        topic,
        number: {
          id: minimal.id,
          number: minimal.number,
          conditionLatex: null as string | null,
          answerLatex: null as string | null
        }
      };
    }

    throw error;
  }

  return {
    topic,
    number: {
      id: homeworkNumber.id,
      number: homeworkNumber.number,
      conditionLatex: (homeworkNumber as { conditionLatex?: string | null }).conditionLatex ?? null,
      answerLatex: (homeworkNumber as { answerLatex?: string | null }).answerLatex ?? null
    }
  };
}

function startOfTimelineDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addTimelineDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getTimelineDateKey(date: Date) {
  // Локальная дата процесса (TZ=Europe/Moscow), НЕ toISOString: iso сдвигает
  // ключ на сутки назад для всех часовых поясов восточнее UTC после полуночи.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


// ── Teacher: Homework Assignments (ДЗ) ─────────────────────────────

function isMissingHomeworkAssignmentTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    (error.message.includes("HomeworkAssignment") ||
      error.message.includes("HomeworkSubmissionPhoto") ||
      error.message.includes("HomeworkCheck"))
  );
}

function queryTeacherStudentHomeworks(studentId: string, notesEnabled: boolean) {
  return prisma.homeworkAssignment.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      deadlineAt: true,
      createdAt: true,
      topic: {
        select: {
          id: true,
          title: true
        }
      },
      numbers: {
        select: {
          homeworkNumber: {
            select: {
              id: true,
              number: true,
              conditionLatex: true,
              answerLatex: true,
              statuses: {
                where: { studentId },
                select: {
                  status: true,
                  ...(notesEnabled ? { note: true } : {})
                }
              }
            }
          }
        }
      },
      photos: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          file: {
            select: {
              id: true,
              originalName: true,
              mimeType: true
            }
          }
        }
      },
      checks: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          status: true,
          error: true,
          createdAt: true,
          checkedAt: true,
          results: {
            select: {
              homeworkNumberId: true,
              verdict: true,
              recognizedAnswer: true,
              comment: true,
              copySuspected: true,
              copyReason: true
            }
          },
          photos: {
            orderBy: { order: "asc" },
            select: {
              file: {
                select: {
                  id: true,
                  originalName: true
                }
              }
            }
          }
        }
      }
    }
  });
}

async function getTeacherStudentHomeworksUncached(studentId: string) {
  let assignments: Awaited<ReturnType<typeof queryTeacherStudentHomeworks>>;
  let notesEnabled = true;

  try {
    assignments = await queryTeacherStudentHomeworks(studentId, true);
  } catch (error) {
    if (isMissingHomeworkAssignmentTableError(error)) {
      logWarnEvent(
        "platform.teacher_student_homeworks.table_missing",
        { studentId },
        undefined,
        "HomeworkAssignment table is missing; apply the latest migration."
      );

      return { assignmentsEnabled: false as const, notesEnabled: true, assignments: [] };
    }

    if (!isMissingStudentStatusColumnError(error, "note")) {
      throw error;
    }

    notesEnabled = false;
    assignments = await queryTeacherStudentHomeworks(studentId, false);
  }

  const orderByTopicId = new Map<string, number>();

  const mapped = assignments.map((assignment) => {
    const orderInTopic = (orderByTopicId.get(assignment.topic.id) ?? 0) + 1;
    orderByTopicId.set(assignment.topic.id, orderInTopic);

    const numbers = assignment.numbers
      .map((entry) => {
        const status = entry.homeworkNumber.statuses[0] ?? null;

        return {
          homeworkNumberId: entry.homeworkNumber.id,
          number: entry.homeworkNumber.number,
          conditionLatex: entry.homeworkNumber.conditionLatex ?? null,
          answerLatex: entry.homeworkNumber.answerLatex ?? null,
          status: status?.status ?? null,
          note: notesEnabled ? ((status as { note?: string | null } | null)?.note ?? "") : ""
        };
      })
      .sort((left, right) => left.number - right.number);

    const numberById = new Map(numbers.map((entry) => [entry.homeworkNumberId, entry.number]));
    const checks = assignment.checks.map((check) => ({
      id: check.id,
      status: check.status,
      error: check.error,
      createdAt: check.createdAt,
      checkedAt: check.checkedAt,
      photos: check.photos.map((photo) => ({
        fileId: photo.file.id,
        originalName: photo.file.originalName
      })),
      results: check.results
        .map((result) => ({
          number: numberById.get(result.homeworkNumberId) ?? 0,
          verdict: result.verdict,
          recognizedAnswer: result.recognizedAnswer,
          comment: result.comment,
          copySuspected: result.copySuspected,
          copyReason: result.copyReason
        }))
        .filter((result) => result.number > 0)
        .sort((left, right) => left.number - right.number)
    }));
    const latestCheck = checks[0] ?? null;

    const summary = buildProgress(numbers.map((entry) => entry.status), numbers.length);
    const solvedCount = summary.greenCount + summary.yellowCount;

    return {
      id: assignment.id,
      label: assignment.title?.trim() || `ДЗ ${orderInTopic}`,
      topicId: assignment.topic.id,
      topicTitle: assignment.topic.title,
      deadlineAt: assignment.deadlineAt,
      createdAt: assignment.createdAt,
      numbers,
      latestCheck,
      checks,
      photos: assignment.photos.map((photo) => ({
        id: photo.id,
        fileId: photo.file.id,
        originalName: photo.file.originalName,
        mimeType: photo.file.mimeType,
        createdAt: photo.createdAt
      })),
      solvedCount,
      solvedPercent: completionPercent(solvedCount, summary.totalNumbers),
      ...summary
    };
  });

  return { assignmentsEnabled: true as const, notesEnabled, assignments: mapped.reverse() };
}

// Кэш с коротким TTL: вердикты ИИ пишет фоновая очередь, которая не может надёжно
// инвалидировать теги вне request-контекста, поэтому кэш сам истекает раз в 15 секунд.
const getTeacherStudentHomeworksCached = unstable_cache(getTeacherStudentHomeworksUncached, ["teacher-student-homeworks"], {
  revalidate: 15,
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
});

export async function getTeacherStudentHomeworks(
  studentId: string
): Promise<Awaited<ReturnType<typeof getTeacherStudentHomeworksUncached>>> {
  return getTeacherStudentHomeworksCached(studentId);
}

export async function getStudentHomeworks(
  studentId: string
): Promise<Awaited<ReturnType<typeof getTeacherStudentHomeworksUncached>>> {
  return getTeacherStudentHomeworksCached(studentId);
}

// ── Developer statistics ─────────────────────────────

async function getDeveloperStatisticsUncached() {
  let assignments: Array<{
    id: string;
    studentId: string;
    deadlineAt: Date | null;
    numbers: Array<{ homeworkNumberId: string }>;
    _count: { photos: number };
  }> = [];

  try {
    assignments = await prisma.homeworkAssignment.findMany({
      select: {
        id: true,
        studentId: true,
        deadlineAt: true,
        numbers: {
          select: { homeworkNumberId: true }
        },
        _count: {
          select: { photos: true }
        }
      }
    });
  } catch (error) {
    if (!isMissingHomeworkAssignmentTableError(error)) {
      throw error;
    }
  }

  const markedStatuses = await prisma.studentTopicNumberStatus.findMany({
    where: {
      status: {
        not: null
      }
    },
    select: {
      studentId: true,
      homeworkNumberId: true,
      status: true
    }
  });
  const solvedKeys = new Set<string>();
  const greenKeys = new Set<string>();
  const yellowKeys = new Set<string>();
  const redKeys = new Set<string>();
  const markedKeys = new Set<string>();

  for (const status of markedStatuses) {
    const key = `${status.studentId}:${status.homeworkNumberId}`;
    markedKeys.add(key);

    if (status.status === HomeworkNumberStatus.RED) {
      redKeys.add(key);
    } else if (status.status === HomeworkNumberStatus.GREEN) {
      greenKeys.add(key);
      solvedKeys.add(key);
    } else {
      yellowKeys.add(key);
      solvedKeys.add(key);
    }
  }

  const issuedKeys = new Set<string>();
  const now = Date.now();
  let completedCount = 0;
  let overdueCount = 0;
  let inProgressCount = 0;
  let withPhotosCount = 0;
  let photosTotal = 0;

  for (const assignment of assignments) {
    const totalNumbers = assignment.numbers.length;
    let solvedNumbers = 0;

    for (const entry of assignment.numbers) {
      const key = `${assignment.studentId}:${entry.homeworkNumberId}`;
      issuedKeys.add(key);

      if (solvedKeys.has(key)) {
        solvedNumbers += 1;
      }
    }

    const isCompleted = totalNumbers > 0 && solvedNumbers === totalNumbers;

    if (isCompleted) {
      completedCount += 1;
    } else if (assignment.deadlineAt && assignment.deadlineAt.getTime() < now) {
      overdueCount += 1;
    } else {
      inProgressCount += 1;
    }

    if (assignment._count.photos > 0) {
      withPhotosCount += 1;
    }

    photosTotal += assignment._count.photos;
  }

  let issuedSolvedCount = 0;
  let issuedGreenCount = 0;
  let issuedYellowCount = 0;
  let issuedRedCount = 0;
  let issuedMarkedCount = 0;

  for (const key of issuedKeys) {
    if (markedKeys.has(key)) {
      issuedMarkedCount += 1;
    }

    if (solvedKeys.has(key)) {
      issuedSolvedCount += 1;
    }

    if (greenKeys.has(key)) {
      issuedGreenCount += 1;
    }

    if (yellowKeys.has(key)) {
      issuedYellowCount += 1;
    }

    if (redKeys.has(key)) {
      issuedRedCount += 1;
    }
  }

  const topics = await prisma.topic.findMany({
    select: {
      id: true,
      title: true,
      theoryFileId: true,
      homeworkFileId: true,
      homeworkNumbers: {
        select: {
          conditionLatex: true,
          answerLatex: true
        }
      }
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }]
  });

  let totalNumbers = 0;
  let numbersWithCondition = 0;
  let numbersWithAnswer = 0;
  let topicsWithTheory = 0;
  let topicsWithHomeworkFile = 0;

  const contentGaps: Array<{ topicId: string; title: string; missing: string[] }> = [];

  for (const topic of topics) {
    const missing: string[] = [];
    const missingConditions = topic.homeworkNumbers.filter((number) => !number.conditionLatex?.trim()).length;
    const missingAnswers = topic.homeworkNumbers.filter((number) => !number.answerLatex?.trim()).length;

    totalNumbers += topic.homeworkNumbers.length;
    numbersWithCondition += topic.homeworkNumbers.length - missingConditions;
    numbersWithAnswer += topic.homeworkNumbers.length - missingAnswers;

    if (topic.theoryFileId) {
      topicsWithTheory += 1;
    } else {
      missing.push("нет файла теории");
    }

    if (topic.homeworkFileId) {
      topicsWithHomeworkFile += 1;
    } else {
      missing.push("нет файла заданий");
    }

    if (missingConditions > 0) {
      missing.push(`без условия: ${missingConditions}`);
    }

    if (missingAnswers > 0) {
      missing.push(`без ответа: ${missingAnswers}`);
    }

    if (missing.length > 0) {
      contentGaps.push({ topicId: topic.id, title: topic.title, missing });
    }
  }

  return {
    homework: {
      total: assignments.length,
      completedCount,
      overdueCount,
      inProgressCount,
      withPhotosCount,
      photosTotal,
      issuedNumbersTotal: issuedKeys.size,
      issuedNumbersSolved: issuedSolvedCount,
      issuedNumbersGreen: issuedGreenCount,
      issuedNumbersYellow: issuedYellowCount,
      issuedNumbersRed: issuedRedCount,
      issuedNumbersUnmarked: issuedKeys.size - issuedMarkedCount
    },
    content: {
      totalTopics: topics.length,
      totalNumbers,
      numbersWithCondition,
      numbersWithAnswer,
      topicsWithTheory,
      topicsWithHomeworkFile,
      gaps: contentGaps
    }
  };
}

const getDeveloperStatisticsCached = unstable_cache(getDeveloperStatisticsUncached, ["developer-statistics"], {
  tags: [PLATFORM_DATA_TAGS.studentTopics, PLATFORM_DATA_TAGS.teacherTopics, PLATFORM_DATA_TAGS.teacherStudents]
});

export async function getDeveloperStatistics(): Promise<Awaited<ReturnType<typeof getDeveloperStatisticsUncached>>> {
  return getDeveloperStatisticsCached();
}

export async function findTopicIdByNumber(targetNumber: number) {
  const homeworkNumber = await prisma.topicHomeworkNumber.findFirst({
    where: { number: targetNumber },
    orderBy: [{ topic: { displayOrder: "asc" } }, { topic: { createdAt: "asc" } }],
    select: { topicId: true }
  });

  return homeworkNumber?.topicId ?? null;
}

/* ───────────────────────────────────────────────────────────────────────────
   Группы учеников и уроки (ИИ-подбор заданий на занятие)
   ─────────────────────────────────────────────────────────────────────────── */

async function getTeacherGroupsUncached() {
  try {
    const groups = await prisma.studentGroup.findMany({
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        subject: true,
        grade: true,
        createdAt: true,
        members: {
          orderBy: { user: { name: "asc" } },
          select: {
            speed: true,
            aiNote: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      subject: group.subject,
      grade: group.grade,
      createdAt: group.createdAt,
      membersCount: group.members.length,
      members: group.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        speed: member.speed,
        aiNote: member.aiNote
      }))
    }));
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      logWarnEvent(
        "platform.teacher_groups.degraded",
        {},
        error,
        "Student groups tables are not migrated yet; returning empty list."
      );
      return [];
    }

    throw error;
  }
}

const getTeacherGroupsCached = unstable_cache(getTeacherGroupsUncached, ["teacher-groups"], {
  tags: [PLATFORM_DATA_TAGS.teacherStudents]
});

export async function getTeacherGroups(): Promise<Awaited<ReturnType<typeof getTeacherGroupsUncached>>> {
  return getTeacherGroupsCached();
}

export async function getGroupDetail(groupId: string) {
  try {
    const group = await prisma.studentGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        subject: true,
        grade: true,
        createdAt: true,
        members: {
          orderBy: { user: { name: "asc" } },
          select: {
            speed: true,
            aiNote: true,
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!group) {
      return null;
    }

    const memberIds = group.members.map((member) => member.user.id);

    const [allStudents, statusGroups, totalNumbers] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.STUDENT },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          studentProfile: { select: { groupId: true } }
        }
      }),
      memberIds.length
        ? prisma.studentTopicNumberStatus.groupBy({
            by: ["studentId", "status"],
            where: { studentId: { in: memberIds }, status: { not: null } },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      prisma.topicHomeworkNumber.count()
    ]);

    const progressByStudent = new Map<string, { greenCount: number; yellowCount: number; redCount: number }>();

    for (const row of statusGroups) {
      const entry = progressByStudent.get(row.studentId) ?? { greenCount: 0, yellowCount: 0, redCount: 0 };

      if (row.status === HomeworkNumberStatus.GREEN) entry.greenCount += row._count._all;
      if (row.status === HomeworkNumberStatus.YELLOW) entry.yellowCount += row._count._all;
      if (row.status === HomeworkNumberStatus.RED) entry.redCount += row._count._all;

      progressByStudent.set(row.studentId, entry);
    }

    return {
      id: group.id,
      name: group.name,
      subject: group.subject,
      grade: group.grade,
      createdAt: group.createdAt,
      totalNumbers,
      members: group.members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        speed: member.speed,
        aiNote: member.aiNote,
        progress: progressByStudent.get(member.user.id) ?? { greenCount: 0, yellowCount: 0, redCount: 0 }
      })),
      allStudents: allStudents.map((student) => ({
        id: student.id,
        name: student.name,
        email: student.email,
        groupId: student.studentProfile?.groupId ?? null
      }))
    };
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getHomeworkPlans() {
  try {
    const plans = await prisma.lesson.findMany({
      where: { kind: "HOMEWORK" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        deadlineAt: true,
        createdAt: true,
        topic: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        participants: {
          select: { id: true, planGeneratedAt: true, planError: true, issuedAssignmentId: true }
        }
      }
    });

    return plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      deadlineAt: plan.deadlineAt,
      createdAt: plan.createdAt,
      topicTitle: plan.topic?.title ?? null,
      groupName: plan.group?.name ?? null,
      participantsCount: plan.participants.length,
      readyCount: plan.participants.filter((participant) => participant.planGeneratedAt).length,
      failedCount: plan.participants.filter((participant) => participant.planError).length,
      issuedCount: plan.participants.filter((participant) => participant.issuedAssignmentId).length
    }));
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getTeacherLessons() {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { kind: "LESSON" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        durationMinutes: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
        participants: {
          select: { id: true, planGeneratedAt: true, planError: true, student: { select: { name: true } } }
        }
      }
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      durationMinutes: lesson.durationMinutes,
      createdAt: lesson.createdAt,
      groupName: lesson.group?.name ?? null,
      // Для индивидуального урока в списке вместо группы показывается имя ученика.
      soloStudentName:
        !lesson.group && lesson.participants.length === 1 ? lesson.participants[0].student.name : null,
      participantsCount: lesson.participants.length,
      readyCount: lesson.participants.filter((participant) => participant.planGeneratedAt).length,
      failedCount: lesson.participants.filter((participant) => participant.planError).length
    }));
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      return [];
    }

    throw error;
  }
}

/**
 * Контекст ИИ-подбора для одного ученика: банк номеров с его статусами,
 * исключения (прошлые уроки + активные ДЗ + уже решённые номера), история
 * выданных ДЗ и агрегаты прогресса. Некэшированная — вызывается из очереди генерации.
 */
export async function getLessonPlanContext(studentId: string, topicIds?: string[]) {
  const now = new Date();

  const [student, profile, topics, lessonItems, allAssignments, allStatuses, numberTotals] = await Promise.all([
    prisma.user.findFirst({
      where: { id: studentId, role: UserRole.STUDENT },
      select: { id: true, name: true }
    }),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: { speed: true, aiNote: true }
    }),
    prisma.topic.findMany({
      where: topicIds && topicIds.length > 0 ? { id: { in: topicIds } } : undefined,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        displayOrder: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            number: true,
            displayOrder: true,
            difficulty: true,
            estimatedMinutes: true,
            conditionLatex: true,
            statuses: {
              where: { studentId },
              select: { status: true, note: true, deadlineAt: true, statusChangedAt: true }
            }
          }
        }
      }
    }),
    prisma.lessonAssignmentItem.findMany({
      where: { participant: { studentId } },
      select: {
        homeworkNumberId: true,
        result: true,
        homeworkNumber: { select: { topic: { select: { title: true } } } },
        participant: {
          select: { lesson: { select: { id: true, kind: true, title: true, createdAt: true } } }
        }
      }
    }),
    // Все ДЗ ученика (не только активные): активные дают исключения,
    // вся история идёт модели как homeworkHistory + флаг assignedBefore.
    prisma.homeworkAssignment.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deadlineAt: true,
        createdAt: true,
        topic: { select: { title: true } },
        numbers: { select: { homeworkNumberId: true } }
      }
    }),
    // Карта тем целиком (без фильтра topicIds): модель должна видеть общий уровень.
    prisma.studentTopicNumberStatus.findMany({
      where: { studentId, status: { not: null } },
      select: {
        homeworkNumberId: true,
        status: true,
        statusChangedAt: true,
        homeworkNumber: { select: { topic: { select: { id: true, title: true } } } }
      }
    }),
    prisma.topicHomeworkNumber.groupBy({ by: ["topicId"], _count: { _all: true } })
  ]);

  if (!student) {
    return null;
  }

  // Последние ошибки с комментариями ИИ-проверки: причины («перепутал знак», «не учёл ОДЗ»)
  // собираются кодом, без отдельного запроса к модели.
  const recentMistakeRows = await prisma.homeworkCheckResult
    .findMany({
      where: {
        verdict: { in: [SolutionVerdict.INCORRECT, SolutionVerdict.UNCERTAIN] },
        check: { status: SolutionCheckStatus.DONE, assignment: { studentId } }
      },
      orderBy: { check: { checkedAt: "desc" } },
      take: 12,
      select: {
        verdict: true,
        comment: true,
        homeworkNumber: { select: { number: true, topic: { select: { title: true } } } }
      }
    })
    .catch(() => []);

  const totalsByTopic = new Map(numberTotals.map((row) => [row.topicId, row._count._all]));
  const overviewByTopic = new Map<
    string,
    { topic: string; total: number; green: number; yellow: number; red: number; lastActivityAt: Date | null }
  >();

  for (const row of allStatuses) {
    const topic = row.homeworkNumber.topic;
    const entry = overviewByTopic.get(topic.id) ?? {
      topic: topic.title,
      total: totalsByTopic.get(topic.id) ?? 0,
      green: 0,
      yellow: 0,
      red: 0,
      lastActivityAt: null
    };

    if (row.status === HomeworkNumberStatus.GREEN) entry.green += 1;
    if (row.status === HomeworkNumberStatus.YELLOW) entry.yellow += 1;
    if (row.status === HomeworkNumberStatus.RED) entry.red += 1;

    if (row.statusChangedAt && (!entry.lastActivityAt || row.statusChangedAt > entry.lastActivityAt)) {
      entry.lastActivityAt = row.statusChangedAt;
    }

    overviewByTopic.set(topic.id, entry);
  }

  let solvedLast7Days = 0;
  let solvedLast30Days = 0;

  for (const row of allStatuses) {
    if (row.status !== HomeworkNumberStatus.GREEN || !row.statusChangedAt) {
      continue;
    }

    const ageDays = (now.getTime() - row.statusChangedAt.getTime()) / 86_400_000;

    if (ageDays <= 7) solvedLast7Days += 1;
    if (ageDays <= 30) solvedLast30Days += 1;
  }

  const topicsOverview = Array.from(overviewByTopic.values()).map((entry) => ({
    topic: entry.topic,
    total: entry.total,
    green: entry.green,
    yellow: entry.yellow,
    red: entry.red,
    daysSinceActivity: entry.lastActivityAt
      ? Math.max(0, Math.floor((now.getTime() - entry.lastActivityAt.getTime()) / 86_400_000))
      : null
  }));

  const statusByNumberId = new Map<string, HomeworkNumberStatus>();

  for (const row of allStatuses) {
    if (row.status) {
      statusByNumberId.set(row.homeworkNumberId, row.status);
    }
  }

  const excludedNumberIds = new Set<string>();
  // Итог урока «не решил» (NOT_SOLVED) возвращает номер в кандидаты подбора;
  // остальные выданные на уроках номера исключаются, как раньше.
  const attemptedInLessonIds = new Set<string>();

  for (const item of lessonItems) {
    if (item.result === LessonItemResult.NOT_SOLVED) {
      attemptedInLessonIds.add(item.homeworkNumberId);
    } else {
      excludedNumberIds.add(item.homeworkNumberId);
    }
  }

  // Номер мог попасть в несколько уроков с разными итогами — исключение сильнее возврата.
  for (const id of attemptedInLessonIds) {
    if (excludedNumberIds.has(id)) {
      attemptedInLessonIds.delete(id);
    }
  }

  const assignedNumberIds = new Set<string>();

  for (const assignment of allAssignments) {
    const isActive = !assignment.deadlineAt || assignment.deadlineAt >= now;

    for (const entry of assignment.numbers) {
      assignedNumberIds.add(entry.homeworkNumberId);

      if (isActive) {
        excludedNumberIds.add(entry.homeworkNumberId);
      }
    }
  }

  // Прорешанные номера никогда не повторяются — ни в уроке, ни в ДЗ:
  // GREEN (решено) и YELLOW (решено с ошибками). Один и тот же номер не решают
  // по несколько раз. RED (не решено) остаётся в кандидатах.
  for (const [numberId, status] of statusByNumberId) {
    if (status === HomeworkNumberStatus.GREEN || status === HomeworkNumberStatus.YELLOW) {
      excludedNumberIds.add(numberId);
    }
  }

  // История выданных ДЗ (последние 8): модель видит, что уже выдавалось и с каким итогом.
  const homeworkHistory = allAssignments.slice(0, 8).map((assignment) => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    let untouched = 0;

    for (const entry of assignment.numbers) {
      const status = statusByNumberId.get(entry.homeworkNumberId) ?? null;

      if (status === HomeworkNumberStatus.GREEN) green += 1;
      else if (status === HomeworkNumberStatus.YELLOW) yellow += 1;
      else if (status === HomeworkNumberStatus.RED) red += 1;
      else untouched += 1;
    }

    return {
      topic: assignment.topic?.title ?? null,
      issuedAt: assignment.createdAt,
      deadlineAt: assignment.deadlineAt,
      total: assignment.numbers.length,
      green,
      yellow,
      red,
      untouched
    };
  });

  // История занятий (последние 8): модель видит, как прошли уроки — что решено, что нет.
  const lessonHistoryMap = new Map<
    string,
    {
      title: string | null;
      date: Date;
      topics: Set<string>;
      total: number;
      solved: number;
      partial: number;
      notSolved: number;
      unmarked: number;
    }
  >();

  for (const item of lessonItems) {
    const lesson = item.participant.lesson;

    if (lesson.kind !== LessonKind.LESSON) {
      continue;
    }

    const entry = lessonHistoryMap.get(lesson.id) ?? {
      title: lesson.title || null,
      date: lesson.createdAt,
      topics: new Set<string>(),
      total: 0,
      solved: 0,
      partial: 0,
      notSolved: 0,
      unmarked: 0
    };

    entry.total += 1;
    entry.topics.add(item.homeworkNumber.topic.title);

    if (item.result === LessonItemResult.SOLVED) entry.solved += 1;
    else if (item.result === LessonItemResult.PARTIAL) entry.partial += 1;
    else if (item.result === LessonItemResult.NOT_SOLVED) entry.notSolved += 1;
    else entry.unmarked += 1;

    lessonHistoryMap.set(lesson.id, entry);
  }

  const lessonHistory = Array.from(lessonHistoryMap.values())
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 8)
    .map((entry) => ({
      title: entry.title,
      date: entry.date,
      topics: Array.from(entry.topics),
      total: entry.total,
      solved: entry.solved,
      partial: entry.partial,
      notSolved: entry.notSolved,
      unmarked: entry.unmarked
    }));

  let greenCount = 0;
  let yellowCount = 0;
  let redCount = 0;

  const mappedTopics = topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    displayOrder: topic.displayOrder,
    numbers: topic.homeworkNumbers.map((number) => {
      const status = number.statuses[0] ?? null;

      if (status?.status === HomeworkNumberStatus.GREEN) greenCount += 1;
      if (status?.status === HomeworkNumberStatus.YELLOW) yellowCount += 1;
      if (status?.status === HomeworkNumberStatus.RED) redCount += 1;

      return {
        id: number.id,
        number: number.number,
        displayOrder: number.displayOrder,
        difficulty: number.difficulty,
        estimatedMinutes: number.estimatedMinutes,
        conditionLatex: number.conditionLatex,
        status: status?.status ?? null,
        note: status?.note ?? null,
        deadlineAt: status?.deadlineAt ?? null,
        statusChangedAt: status?.statusChangedAt ?? null,
        assignedBefore: assignedNumberIds.has(number.id),
        attemptedInLesson: attemptedInLessonIds.has(number.id)
      };
    })
  }));

  return {
    student: {
      id: student.id,
      name: student.name,
      speed: profile?.speed ?? null,
      aiNote: profile?.aiNote ?? null
    },
    recentMistakes: recentMistakeRows.map((row) => ({
      topic: row.homeworkNumber?.topic.title ?? null,
      number: row.homeworkNumber?.number ?? null,
      verdict: row.verdict,
      comment: row.comment ? row.comment.slice(0, 200) : null
    })),
    activity: { solvedLast7Days, solvedLast30Days },
    topicsOverview,
    homeworkHistory,
    lessonHistory,
    topics: mappedTopics,
    excludedNumberIds: Array.from(excludedNumberIds),
    stats: { greenCount, yellowCount, redCount }
  };
}

export async function getLessonDetail(lessonId: string) {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        title: true,
        status: true,
        kind: true,
        topicId: true,
        deadlineAt: true,
        durationMinutes: true,
        planParams: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
        participants: {
          orderBy: { student: { name: "asc" } },
          select: {
            id: true,
            studentId: true,
            speed: true,
            planSummary: true,
            planGeneratedAt: true,
            planError: true,
            issuedAssignmentId: true,
            issuedAt: true,
            createdAt: true,
            student: { select: { id: true, name: true } },
            items: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                reason: true,
                minutes: true,
                comment: true,
                isExtra: true,
                result: true,
                homeworkNumber: {
                  select: {
                    id: true,
                    number: true,
                    difficulty: true,
                    conditionLatex: true,
                    topic: { select: { id: true, title: true } },
                    statuses: { select: { studentId: true, status: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!lesson) {
      return null;
    }

    // issuedAssignmentId хранится без FK: проверяем, что ДЗ ещё существует
    // (его могли отменить через DELETE /api/teacher/homeworks).
    const issuedIds = lesson.participants
      .map((participant) => participant.issuedAssignmentId)
      .filter((value): value is string => Boolean(value));
    const existingAssignments = issuedIds.length
      ? await prisma.homeworkAssignment.findMany({
          where: { id: { in: issuedIds } },
          select: { id: true }
        })
      : [];
    const existingAssignmentIds = new Set(existingAssignments.map((assignment) => assignment.id));

    return {
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      kind: lesson.kind,
      topicId: lesson.topicId,
      deadlineAt: lesson.deadlineAt,
      durationMinutes: lesson.durationMinutes,
      planParams: lesson.planParams,
      createdAt: lesson.createdAt,
      group: lesson.group,
      participants: lesson.participants.map((participant) => ({
        id: participant.id,
        studentId: participant.studentId,
        studentName: participant.student.name,
        speed: participant.speed,
        planSummary: participant.planSummary,
        planGeneratedAt: participant.planGeneratedAt,
        planError: participant.planError,
        issuedAssignmentId:
          participant.issuedAssignmentId && existingAssignmentIds.has(participant.issuedAssignmentId)
            ? participant.issuedAssignmentId
            : null,
        issuedAt:
          participant.issuedAssignmentId && existingAssignmentIds.has(participant.issuedAssignmentId)
            ? participant.issuedAt
            : null,
        createdAt: participant.createdAt,
        items: participant.items.map((item) => ({
          id: item.id,
          order: item.order,
          reason: item.reason,
          minutes: item.minutes,
          comment: item.comment,
          isExtra: item.isExtra,
          result: item.result,
          homeworkNumberId: item.homeworkNumber.id,
          number: item.homeworkNumber.number,
          difficulty: item.homeworkNumber.difficulty,
          conditionLatex: item.homeworkNumber.conditionLatex,
          topicId: item.homeworkNumber.topic.id,
          topicTitle: item.homeworkNumber.topic.title,
          studentStatus:
            item.homeworkNumber.statuses.find((status) => status.studentId === participant.studentId)?.status ?? null
        }))
      }))
    };
  } catch (error) {
    if (isRecoverablePlatformDataError(error)) {
      return null;
    }

    throw error;
  }
}
