import { getLessonDetail, type TeacherViewer } from "@/lib/platform-data";
import type { LessonPrintData } from "@/lib/lesson-print-html";

/** Данные раздатки: урок целиком или один ученик (?studentId=…). Урок ищется
 * в скоупе владельца — чужая раздатка недоступна (SEC-002). */
export async function buildLessonPrintPayload(viewer: TeacherViewer, lessonId: string, studentId: string | null) {
  const lesson = await getLessonDetail(viewer, lessonId);

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
    durationMinutes: lesson.durationMinutes,
    kind: lesson.kind,
    participants: participants.map((participant) => ({
      studentName: participant.studentName,
      items: participant.items.map((item) => ({
        number: item.number,
        topicTitle: item.topicTitle,
        conditionLatex: item.conditionLatex,
        answerLatex: item.answerLatex,
        isExtra: item.isExtra
      }))
    }))
  };

  return { lesson, printData };
}
