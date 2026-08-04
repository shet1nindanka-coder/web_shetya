import { normalizeHomeworkNumber } from "@/lib/utils";

export type TeacherTopicSelectionTopic = {
  id: string;
  title: string;
  description: string;
  totalNumbers: number;
  solvedCount: number;
  numbers: Array<{
    studentStatus: {
      deadlineAt: string | null;
    } | null;
  }>;
};

export type TeacherTopicNumberSearchTopic = {
  id: string;
  displayOrder: number;
  createdAt: Date | string;
  homeworkNumbers: Array<{
    number: string;
  }>;
};

export function getDefaultTeacherTopicId(topics: TeacherTopicSelectionTopic[]) {
  if (!topics.length) {
    return null;
  }

  let latestIssuedIndex = -1;
  let latestIssuedTimestamp = -1;

  topics.forEach((topic, index) => {
    const topicTimestamp = getLatestIssuedTimestamp(topic);

    if (topicTimestamp === null) {
      return;
    }

    if (topicTimestamp >= latestIssuedTimestamp) {
      latestIssuedTimestamp = topicTimestamp;
      latestIssuedIndex = index;
    }
  });

  if (latestIssuedIndex === -1) {
    return topics[0]!.id;
  }

  const latestIssuedTopic = topics[latestIssuedIndex]!;

  if (shouldAdvanceToNextTopic(latestIssuedTopic) && latestIssuedIndex < topics.length - 1) {
    return topics[latestIssuedIndex + 1]!.id;
  }

  return latestIssuedTopic.id;
}

export function filterTeacherTopicsByQuery<T extends Pick<TeacherTopicSelectionTopic, "title" | "description">>(
  topics: T[],
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

  if (!normalizedQuery) {
    return topics;
  }

  return topics.filter((topic) => {
    const haystack = `${topic.title} ${topic.description}`.toLocaleLowerCase("ru-RU");
    return haystack.includes(normalizedQuery);
  });
}

export function moveTopicByDirection<T extends { id: string }>(
  topics: T[],
  topicId: string,
  direction: "up" | "down"
) {
  const currentIndex = topics.findIndex((topic) => topic.id === topicId);

  if (currentIndex === -1) {
    return {
      topics,
      moved: false
    };
  }

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= topics.length) {
    return {
      topics,
      moved: false
    };
  }

  const nextTopics = [...topics];
  const [topic] = nextTopics.splice(currentIndex, 1);
  nextTopics.splice(targetIndex, 0, topic!);

  return {
    topics: nextTopics,
    moved: true
  };
}

export function findTopicByHomeworkNumber<T extends TeacherTopicNumberSearchTopic>(
  topics: T[],
  targetNumber: string
) {
  const normalizedTarget = normalizeHomeworkNumber(targetNumber);

  if (!/^\d+$/.test(normalizedTarget) || normalizedTarget === "0") {
    return null;
  }

  const orderedTopics = [...topics].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    return getSortableTimestamp(left.createdAt) - getSortableTimestamp(right.createdAt);
  });

  return (
    orderedTopics.find((topic) =>
      topic.homeworkNumbers.some((number) => normalizeHomeworkNumber(number.number) === normalizedTarget)
    ) ?? null
  );
}

function getLatestIssuedTimestamp(topic: TeacherTopicSelectionTopic) {
  let latestTimestamp: number | null = null;

  topic.numbers.forEach((number) => {
    const deadlineAt = number.studentStatus?.deadlineAt;

    if (!deadlineAt) {
      return;
    }

    const timestamp = new Date(deadlineAt).getTime();

    if (Number.isNaN(timestamp)) {
      return;
    }

    if (latestTimestamp === null || timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }
  });

  return latestTimestamp;
}

function shouldAdvanceToNextTopic(topic: TeacherTopicSelectionTopic) {
  const hasNumbers = topic.totalNumbers > 0;
  const allNumbersIssued =
    hasNumbers && topic.numbers.every((number) => Boolean(number.studentStatus?.deadlineAt));
  const isCompleted = hasNumbers && topic.solvedCount >= topic.totalNumbers;

  return allNumbersIssued || isCompleted;
}

function getSortableTimestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}
