ALTER TABLE "TopicHomeworkNumber"
ADD COLUMN "answerFileId" TEXT;

CREATE INDEX "TopicHomeworkNumber_answerFileId_idx"
ON "TopicHomeworkNumber"("answerFileId");

ALTER TABLE "TopicHomeworkNumber"
ADD CONSTRAINT "TopicHomeworkNumber_answerFileId_fkey"
FOREIGN KEY ("answerFileId") REFERENCES "StoredFile"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
