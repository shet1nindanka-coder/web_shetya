import test from "node:test";
import assert from "node:assert/strict";
import { UserRole } from "@prisma/client";
import { canAccessStoredFile, summarizeStoredFileAccess } from "../lib/file-access";

test("teacher can access any stored file snapshot", () => {
  const result = canAccessStoredFile(
    { id: "teacher-1", role: UserRole.TEACHER },
    {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 0,
        homeworkForTopics: 0,
        answerForNumberEntries: 3
      }
    }
  );

  assert.equal(result, true);
});

test("student can access files attached to topic theory or homework", () => {
  const student = { id: "student-1", role: UserRole.STUDENT };

  assert.equal(
    canAccessStoredFile(student, {
      uploadedById: "teacher-1",
      counts: {
        theoryForTopics: 1,
        homeworkForTopics: 0,
        answerForNumberEntries: 0
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
        answerForNumberEntries: 0
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
        answerForNumberEntries: 1
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
        answerForNumberEntries: 0
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
      answerForNumberEntries: 4
    }
  });

  assert.deepEqual(result, {
    uploadedById: "teacher-1",
    theoryTopicCount: 2,
    homeworkTopicCount: 1,
    answerEntryCount: 4
  });
});
