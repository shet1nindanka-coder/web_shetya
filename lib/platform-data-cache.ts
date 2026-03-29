import { revalidateTag } from "next/cache";

export const PLATFORM_DATA_TAGS = {
  studentTopics: "platform-data:student-topics",
  teacherTopics: "platform-data:teacher-topics",
  teacherStudents: "platform-data:teacher-students"
} as const;

export function revalidateStudentTopicsData() {
  revalidateTag(PLATFORM_DATA_TAGS.studentTopics);
}

export function revalidateTeacherTopicsData() {
  revalidateTag(PLATFORM_DATA_TAGS.teacherTopics);
}

export function revalidateTeacherStudentsData() {
  revalidateTag(PLATFORM_DATA_TAGS.teacherStudents);
}

export function revalidateAllPlatformData() {
  revalidateStudentTopicsData();
  revalidateTeacherTopicsData();
  revalidateTeacherStudentsData();
}
