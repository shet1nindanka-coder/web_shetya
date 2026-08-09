import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import { canAccessStoredFile, summarizeStoredFileAccess } from "../lib/file-access";

test("учитель видит файлы тем/банка и свои загрузки", () => {
  const teacher = { id: "teacher-1", role: UserRole.TEACHER };

  // Файл банка ответов — общий контент.
  assert.equal(
    canAccessStoredFile(teacher, {
      uploadedById: "teacher-2",
      counts: { theoryForTopics: 0, homeworkForTopics: 0, answerForNumberEntries: 3, checkPhotoEntries: 0 }
    }),
    true
  );

  // Своя загрузка, ещё никуда не привязанная.
  assert.equal(
    canAccessStoredFile(teacher, {
      uploadedById: "teacher-1",
      counts: { theoryForTopics: 0, homeworkForTopics: 0, answerForNumberEntries: 0, checkPhotoEntries: 0 }
    }),
    true
  );
});

test("учитель НЕ получает чужое фото решения через общий доступ (SEC-003)", () => {
  // Фото решения ученика: не тема и не своя загрузка — общий канал закрыт,
  // принадлежность ученика учителю проверяется отдельным запросом в роуте.
  assert.equal(
    canAccessStoredFile(
      { id: "teacher-2", role: UserRole.TEACHER },
      {
        uploadedById: "student-1",
        counts: { theoryForTopics: 0, homeworkForTopics: 0, answerForNumberEntries: 0, checkPhotoEntries: 1 }
      }
    ),
    false
  );
});

test("student can access files attached to topic theory or homework", () => {
  const student = { id: "student-1", role: UserRole.STUDENT };

  assert.equal(
    canAccessStoredFile(student, {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 1,
        homeworkForTopics: 0,
        answerForNumberEntries: 0,
        checkPhotoEntries: 0
      }
    }),
    true
  );

  assert.equal(
    canAccessStoredFile(student, {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 0,
        homeworkForTopics: 2,
        answerForNumberEntries: 0,
        checkPhotoEntries: 0
      }
    }),
    true
  );
});

test("student cannot access answer-only or unattached files", () => {
  const student = { id: "student-1", role: UserRole.STUDENT };

  assert.equal(
    canAccessStoredFile(student, {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 0,
        homeworkForTopics: 0,
        answerForNumberEntries: 1,
        checkPhotoEntries: 0
      }
    }),
    false
  );

  assert.equal(
    canAccessStoredFile(student, {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 0,
        homeworkForTopics: 0,
        answerForNumberEntries: 0,
        checkPhotoEntries: 1
      }
    }),
    false
  );
});

test("summarizeStoredFileAccess exposes grep-friendly reference counters", () => {
  const result = summarizeStoredFileAccess({
    uploadedById: "teacher-1",
    counts: {
      theoryForTopics: 2,
      homeworkForTopics: 1,
      answerForNumberEntries: 4,
      checkPhotoEntries: 3
    }
  });

  assert.deepEqual(result, {
    uploadedById: "teacher-1",
    theoryTopicCount: 2,
    homeworkTopicCount: 1,
    answerEntryCount: 4,
    checkPhotoEntryCount: 3
  });
});
