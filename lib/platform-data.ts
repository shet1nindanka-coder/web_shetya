import { HomeworkNumberStatus, UserRole } from "@prisma/client";
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

export async function getStudentTopicsOverview(studentId: string) {
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

export async function getStudentTopicDetail(studentId: string, topicId: string) {
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { id: topicId },
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
    }
  });

  const numbers = topic.homeworkNumbers.map((number) => ({
    ...number,
    studentStatus: number.statuses[0] ?? null
  }));
  const progress = buildProgress(
    numbers.map((number) => number.studentStatus?.status ?? null),
    numbers.length
  );

  return {
    ...topic,
    numbers,
    ...progress
  };
}

export async function getTeacherTopicsOverview() {
  const [students, topics] = await Promise.all([
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
      totalFiles: topicCards.reduce((sum, topic) => {
        return sum + (topic.theoryFile ? 1 : 0) + (topic.homeworkFile ? 1 : 0);
      }, 0),
      totalNumbers: topicCards.reduce((sum, topic) => sum + topic.totalNumbers, 0),
      totalMarked: topicCards.reduce((sum, topic) => sum + topic.markedCount, 0)
    }
  };
}

export async function getTeacherTopicDetail(topicId: string) {
  const [topic, students] = await Promise.all([
    prisma.topic.findUniqueOrThrow({
      where: { id: topicId },
      include: {
        theoryFile: true,
        homeworkFile: true,
        homeworkNumbers: {
          orderBy: { displayOrder: "asc" },
          include: {
            statuses: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true
      }
    })
  ]);

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
    students: studentProgress,
    stats: {
      totalStudents: students.length,
      numbersPerStudent: topic.homeworkNumbers.length,
      ...buildProgress(overallStatuses, topic.homeworkNumbers.length * students.length)
    }
  };
}

export async function getDashboardSummary(userId: string, role: UserRole) {
  if (role === UserRole.TEACHER) {
    return getTeacherTopicsOverview();
  }

  return getStudentTopicsOverview(userId);
}
