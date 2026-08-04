import { Prisma } from "@prisma/client";

const CREATE_TOPIC_NUMBERS_BATCH_SIZE = 200;

export type TopicHomeworkNumberRow = {
  number: string;
  displayOrder: number;
};

export async function createTopicHomeworkNumbersInBatches(
  tx: Prisma.TransactionClient,
  topicId: string,
  rows: TopicHomeworkNumberRow[]
) {
  for (let startIndex = 0; startIndex < rows.length; startIndex += CREATE_TOPIC_NUMBERS_BATCH_SIZE) {
    const batch = rows.slice(startIndex, startIndex + CREATE_TOPIC_NUMBERS_BATCH_SIZE);

    await tx.topicHomeworkNumber.createMany({
      data: batch.map((row) => ({
        topicId,
        number: row.number,
        displayOrder: row.displayOrder
      }))
    });
  }
}
