import test from "node:test";
import assert from "node:assert/strict";
import {
  filterTeacherTopicsByQuery,
  getDefaultTeacherTopicId,
  moveTopicByDirection,
  type TeacherTopicSelectionTopic
} from "@/lib/teacher-topic-selection";

function createTopic(
  id: string,
  {
    title,
    description = "",
    totalNumbers = 3,
    solvedCount = 0,
    deadlines = []
  }: {
    title: string;
    description?: string;
    totalNumbers?: number;
    solvedCount?: number;
    deadlines?: Array<string | null>;
  }
): TeacherTopicSelectionTopic {
  return {
    id,
    title,
    description,
    totalNumbers,
    solvedCount,
    numbers: Array.from({ length: totalNumbers }, (_, index) => ({
      studentStatus: {
        deadlineAt: deadlines[index] ?? null
      }
    }))
  };
}

test("getDefaultTeacherTopicId picks the first topic when homework has not been issued yet", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения" }),
    createTopic("topic-2", { title: "Квадратные функции" })
  ];

  assert.equal(getDefaultTeacherTopicId(topics), "topic-1");
});

test("getDefaultTeacherTopicId stays on the latest issued topic while it is still in progress", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения", deadlines: ["2026-04-10T15:00:00.000Z"] }),
    createTopic("topic-2", {
      title: "Квадратные функции",
      deadlines: ["2026-04-12T15:00:00.000Z", null, null]
    })
  ];

  assert.equal(getDefaultTeacherTopicId(topics), "topic-2");
});

test("getDefaultTeacherTopicId advances to the next topic when the latest issued topic is fully issued", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения" }),
    createTopic("topic-2", {
      title: "Квадратные функции",
      deadlines: [
        "2026-04-12T15:00:00.000Z",
        "2026-04-12T15:00:00.000Z",
        "2026-04-12T15:00:00.000Z"
      ]
    }),
    createTopic("topic-3", { title: "Производная" })
  ];

  assert.equal(getDefaultTeacherTopicId(topics), "topic-3");
});

test("getDefaultTeacherTopicId advances to the next topic when the latest issued topic is fully solved", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения" }),
    createTopic("topic-2", {
      title: "Квадратные функции",
      solvedCount: 3,
      deadlines: ["2026-04-12T15:00:00.000Z"]
    }),
    createTopic("topic-3", { title: "Производная" })
  ];

  assert.equal(getDefaultTeacherTopicId(topics), "topic-3");
});

test("filterTeacherTopicsByQuery finds matches by title and description", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения", description: "Базовый курс" }),
    createTopic("topic-2", { title: "Квадратные функции", description: "Парабола" })
  ];

  assert.deepEqual(
    filterTeacherTopicsByQuery(topics, "парабола").map((topic) => topic.id),
    ["topic-2"]
  );
  assert.deepEqual(
    filterTeacherTopicsByQuery(topics, "линейные").map((topic) => topic.id),
    ["topic-1"]
  );
});

test("moveTopicByDirection reorders topics predictably", () => {
  const topics = [
    createTopic("topic-1", { title: "Линейные уравнения" }),
    createTopic("topic-2", { title: "Квадратные функции" }),
    createTopic("topic-3", { title: "Производная" })
  ];

  const movedUp = moveTopicByDirection(topics, "topic-2", "up");
  assert.equal(movedUp.moved, true);
  assert.deepEqual(
    movedUp.topics.map((topic) => topic.id),
    ["topic-2", "topic-1", "topic-3"]
  );

  const movedDown = moveTopicByDirection(topics, "topic-2", "down");
  assert.equal(movedDown.moved, true);
  assert.deepEqual(
    movedDown.topics.map((topic) => topic.id),
    ["topic-1", "topic-3", "topic-2"]
  );

  const noMove = moveTopicByDirection(topics, "topic-1", "up");
  assert.equal(noMove.moved, false);
  assert.deepEqual(noMove.topics, topics);
});
