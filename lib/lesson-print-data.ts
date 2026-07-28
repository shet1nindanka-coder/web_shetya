import { getLessonDetail } from "@/lib/platform-data";
import type { LessonPrintData } from "@/lib/lesson-print-html";

/** Данные раздатки: урок целиком или один ученик (?studentId=…). */
export async function buildLessonPrintPayload(lessonId: string, studentId: string | null) {
  const lesson = await getLessonDetail(lessonId);

  if (!lesson) {
    return null;
  }

  const participants = lesson.participants.filter(
    (participant) => !studentId || participant.studentId === studentId
  );

  const printData: LessonPrintData = {
    title: lesson.title,
    createdAt: lesson.createdAt,
    groupName: lesson.group?.name ?? null,
    participants: participants.map((participant) => ({
      studentName: participant.studentName,
      items: participant.items.map((item) => ({
        number: item.number,
        topicTitle: item.topicTitle,
        conditionLatex: item.conditionLatex
      }))
    }))
  };

  return { lesson, printData };
}
