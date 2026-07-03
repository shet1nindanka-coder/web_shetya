import { unstable_cache } from "next/cache";
import { HomeworkNumberStatus, Prisma, UserRole } from "@prisma/client";
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
      topic.homeworkNumbers.flatMap((number) => number.statuses.map((status) => status.studentId))
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
        updatedAt: { gte: timelineStart },
        status: {
          in: [HomeworkNumberStatus.GREEN, HomeworkNumberStatus.YELLOW, HomeworkNumberStatus.RED]
        },
        ...(studentId ? { studentId } : {})
      },
      select: {
        status: true,
        updatedAt: true
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
      const key = getTimelineDateKey(status.updatedAt);
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
  return date.toISOString().slice(0, 10);
}
