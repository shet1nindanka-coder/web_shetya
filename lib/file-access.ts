import { UserRole } from "@prisma/client";

type FileAccessUser = {
  id: string;
  role: UserRole;
};

type FileAccessCounts = {
  theoryForTopics: number;
  homeworkForTopics: number;
  answerForNumberEntries: number;
  checkPhotoEntries: number;
};

export type StoredFileAccessSnapshot = {
  uploadedById: string;
  counts: FileAccessCounts;
};

export function canAccessStoredFile(user: FileAccessUser, file: StoredFileAccessSnapshot) {
  if (user.role === UserRole.TEACHER) {
    // Файлы тем и банка задач общие; свои загрузки тоже доступны. Фото решений
    // сюда НЕ входят: их принадлежность ученику учителя проверяется отдельным
    // запросом в роуте (ownsStudentPhoto) — чужие детские работы закрыты (SEC-003).
    return (
      file.uploadedById === user.id ||
      file.counts.theoryForTopics > 0 ||
      file.counts.homeworkForTopics > 0 ||
      file.counts.answerForNumberEntries > 0
    );
  }

  return file.counts.theoryForTopics > 0 || file.counts.homeworkForTopics > 0;
}

export function summarizeStoredFileAccess(file: StoredFileAccessSnapshot) {
  return {
    uploadedById: file.uploadedById,
    theoryTopicCount: file.counts.theoryForTopics,
    homeworkTopicCount: file.counts.homeworkForTopics,
    answerEntryCount: file.counts.answerForNumberEntries,
    checkPhotoEntryCount: file.counts.checkPhotoEntries
  };
}
