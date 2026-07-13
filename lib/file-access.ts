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
    return true;
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
