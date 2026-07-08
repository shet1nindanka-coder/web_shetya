import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import { groupStudentDeadlinesAsAssignments, mapStudentHomeworksToDeadlineItems } from "../lib/student-deadline-groups";

test("groupStudentDeadlinesAsAssignments groups by topic and exact deadline", () => {
  const assignments = groupStudentDeadlinesAsAssignments([
    {
      id: "1",
      deadlineAt: "2026-04-10T15:00:00.000Z",
      status: HomeworkNumberStatus.GREEN,
      homeworkNumberId: "n1",
      homeworkNumber: 101,
      topicId: "topic-a",
      topicTitle: "Линейные уравнения"
    },
    {
      id: "2",
      deadlineAt: new Date("2026-04-10T15:00:00.000Z"),
      status: HomeworkNumberStatus.YELLOW,
      homeworkNumberId: "n2",
      homeworkNumber: 102,
      topicId: "topic-a",
      topicTitle: "Линейные уравнения"
    },
    {
      id: "3",
      deadlineAt: "2026-04-12T15:00:00.000Z",
      status: null,
      homeworkNumberId: "n3",
      homeworkNumber: 201,
      topicId: "topic-b",
      topicTitle: "Квадратные уравнения"
    }
  ]);

  assert.equal(assignments.length, 2);
  assert.deepEqual(assignments[0], {
    id: "topic-a::2026-04-10T15:00:00.000Z",
    deadlineAt: "2026-04-10T15:00:00.000Z",
    topicId: "topic-a",
    topicTitle: "Линейные уравнения",
    totalNumbers: 2,
    solvedNumbers: 2,
    status: "DONE"
  });
  assert.deepEqual(assignments[1], {
    id: "topic-b::2026-04-12T15:00:00.000Z",
    deadlineAt: "2026-04-12T15:00:00.000Z",
    topicId: "topic-b",
    topicTitle: "Квадратные уравнения",
    totalNumbers: 1,
    solvedNumbers: 0,
    status: "NOT_STARTED"
  });
});

test("groupStudentDeadlinesAsAssignments marks partially started homework as in progress", () => {
  const assignments = groupStudentDeadlinesAsAssignments([
    {
      id: "1",
      deadlineAt: "2026-04-11T15:00:00.000Z",
      status: HomeworkNumberStatus.RED,
      homeworkNumberId: "n1",
      homeworkNumber: 1,
      topicId: "topic-a",
      topicTitle: "Тема"
    },
    {
      id: "2",
      deadlineAt: "2026-04-11T15:00:00.000Z",
      status: null,
      homeworkNumberId: "n2",
      homeworkNumber: 2,
      topicId: "topic-a",
      topicTitle: "Тема"
    }
  ]);

  assert.equal(assignments[0]?.status, "IN_PROGRESS");
  assert.equal(assignments[0]?.solvedNumbers, 0);
  assert.equal(assignments[0]?.totalNumbers, 2);
});

test("groupStudentDeadlinesAsAssignments skips invalid deadlines", () => {
  const assignments = groupStudentDeadlinesAsAssignments([
    {
      id: "1",
      deadlineAt: "not-a-date",
      status: HomeworkNumberStatus.GREEN,
      homeworkNumberId: "n1",
      homeworkNumber: 1,
      topicId: "topic-a",
      topicTitle: "Тема"
    }
  ]);

  assert.deepEqual(assignments, []);
});

test("mapStudentHomeworksToDeadlineItems maps real assignments to sorted deadline items", () => {
  const items = mapStudentHomeworksToDeadlineItems([
    { id: "a2", label: "ДЗ 2", topicTitle: "Тема", deadlineAt: "2026-04-12T15:00:00.000Z", totalNumbers: 4, solvedCount: 4 },
    { id: "a1", label: "ДЗ 1", topicTitle: "Тема", deadlineAt: "2026-04-10T15:00:00.000Z", totalNumbers: 2, solvedCount: 1 },
    { id: "a3", label: "ДЗ 3", topicTitle: "Тема", deadlineAt: null, totalNumbers: 3, solvedCount: 0 }
  ]);

  assert.equal(items.length, 2);
  assert.equal(items[0]?.id, "a1");
  assert.equal(items[0]?.label, "ДЗ 1 · Тема");
  assert.equal(items[0]?.href, "/student/homeworks/a1");
  assert.equal(items[0]?.status, "IN_PROGRESS");
  assert.equal(items[1]?.status, "DONE");
});

test("mapStudentHomeworksToDeadlineItems skips invalid deadlines", () => {
  const items = mapStudentHomeworksToDeadlineItems([
    { id: "a1", label: "ДЗ 1", topicTitle: "Тема", deadlineAt: "not-a-date", totalNumbers: 2, solvedCount: 0 }
  ]);

  assert.equal(items.length, 0);
});
