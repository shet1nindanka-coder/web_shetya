import test from "node:test";
import assert from "node:assert/strict";
import { HomeworkNumberStatus } from "@prisma/client";
import { groupStudentDeadlinesAsAssignments } from "../lib/student-deadline-groups";

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
