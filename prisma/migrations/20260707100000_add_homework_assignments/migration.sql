-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT,
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignmentNumber" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "homeworkNumberId" TEXT NOT NULL,

    CONSTRAINT "HomeworkAssignmentNumber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkAssignment_studentId_createdAt_idx" ON "HomeworkAssignment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_topicId_idx" ON "HomeworkAssignment"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAssignmentNumber_assignmentId_homeworkNumberId_key" ON "HomeworkAssignmentNumber"("assignmentId", "homeworkNumberId");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentNumber_homeworkNumberId_idx" ON "HomeworkAssignmentNumber"("homeworkNumberId");

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentNumber" ADD CONSTRAINT "HomeworkAssignmentNumber_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentNumber" ADD CONSTRAINT "HomeworkAssignmentNumber_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: существующие дедлайны, сгруппированные по (ученик, тема, дедлайн), становятся ДЗ
INSERT INTO "HomeworkAssignment" ("id", "studentId", "topicId", "deadlineAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    s."studentId",
    n."topicId",
    s."deadlineAt",
    MIN(s."createdAt"),
    CURRENT_TIMESTAMP
FROM "StudentTopicNumberStatus" s
JOIN "TopicHomeworkNumber" n ON n."id" = s."homeworkNumberId"
WHERE s."deadlineAt" IS NOT NULL
GROUP BY s."studentId", n."topicId", s."deadlineAt";

INSERT INTO "HomeworkAssignmentNumber" ("id", "assignmentId", "homeworkNumberId")
SELECT
    gen_random_uuid()::text,
    a."id",
    s."homeworkNumberId"
FROM "StudentTopicNumberStatus" s
JOIN "TopicHomeworkNumber" n ON n."id" = s."homeworkNumberId"
JOIN "HomeworkAssignment" a
  ON a."studentId" = s."studentId"
 AND a."topicId" = n."topicId"
 AND a."deadlineAt" = s."deadlineAt"
WHERE s."deadlineAt" IS NOT NULL;
