-- CreateEnum
CREATE TYPE "HomeworkNumberStatus" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- DropForeignKey
ALTER TABLE "Homework" DROP CONSTRAINT "Homework_createdById_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkAssignment" DROP CONSTRAINT "HomeworkAssignment_homeworkId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkAssignment" DROP CONSTRAINT "HomeworkAssignment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkItem" DROP CONSTRAINT "HomeworkItem_homeworkId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkItemProgress" DROP CONSTRAINT "HomeworkItemProgress_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkItemProgress" DROP CONSTRAINT "HomeworkItemProgress_itemId_fkey";

-- DropForeignKey
ALTER TABLE "TheoryAssignment" DROP CONSTRAINT "TheoryAssignment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "TheoryAssignment" DROP CONSTRAINT "TheoryAssignment_topicId_fkey";

-- DropForeignKey
ALTER TABLE "TheoryTopic" DROP CONSTRAINT "TheoryTopic_createdById_fkey";

-- DropTable
DROP TABLE "Homework";

-- DropTable
DROP TABLE "HomeworkAssignment";

-- DropTable
DROP TABLE "HomeworkItem";

-- DropTable
DROP TABLE "HomeworkItemProgress";

-- DropTable
DROP TABLE "TheoryAssignment";

-- DropTable
DROP TABLE "TheoryTopic";

-- DropEnum
DROP TYPE "TheoryStatus";

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "theoryFileId" TEXT,
    "homeworkFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicHomeworkNumber" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TopicHomeworkNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentTopicNumberStatus" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "homeworkNumberId" TEXT NOT NULL,
    "status" "HomeworkNumberStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTopicNumberStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "Topic_displayOrder_idx" ON "Topic"("displayOrder");

-- CreateIndex
CREATE INDEX "TopicHomeworkNumber_topicId_displayOrder_idx" ON "TopicHomeworkNumber"("topicId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TopicHomeworkNumber_topicId_number_key" ON "TopicHomeworkNumber"("topicId", "number");

-- CreateIndex
CREATE INDEX "StudentTopicNumberStatus_studentId_status_idx" ON "StudentTopicNumberStatus"("studentId", "status");

-- CreateIndex
CREATE INDEX "StudentTopicNumberStatus_homeworkNumberId_idx" ON "StudentTopicNumberStatus"("homeworkNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTopicNumberStatus_studentId_homeworkNumberId_key" ON "StudentTopicNumberStatus"("studentId", "homeworkNumberId");

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_theoryFileId_fkey" FOREIGN KEY ("theoryFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_homeworkFileId_fkey" FOREIGN KEY ("homeworkFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicHomeworkNumber" ADD CONSTRAINT "TopicHomeworkNumber_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicNumberStatus" ADD CONSTRAINT "StudentTopicNumberStatus_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTopicNumberStatus" ADD CONSTRAINT "StudentTopicNumberStatus_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
