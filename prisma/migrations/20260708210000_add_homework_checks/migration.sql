-- CreateEnum
CREATE TYPE "SolutionCheckStatus" AS ENUM ('PENDING', 'CHECKING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SolutionVerdict" AS ENUM ('CORRECT', 'INCORRECT', 'UNCERTAIN');

-- CreateTable
CREATE TABLE "HomeworkCheck" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "status" "SolutionCheckStatus" NOT NULL DEFAULT 'PENDING',
    "modelUsed" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "HomeworkCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkCheckResult" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "homeworkNumberId" TEXT NOT NULL,
    "verdict" "SolutionVerdict" NOT NULL,
    "recognizedAnswer" TEXT,
    "comment" TEXT,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "HomeworkCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkCheck_assignmentId_createdAt_idx" ON "HomeworkCheck"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "HomeworkCheckResult_checkId_idx" ON "HomeworkCheckResult"("checkId");

-- CreateIndex
CREATE INDEX "HomeworkCheckResult_homeworkNumberId_idx" ON "HomeworkCheckResult"("homeworkNumberId");

-- AddForeignKey
ALTER TABLE "HomeworkCheck" ADD CONSTRAINT "HomeworkCheck_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCheckResult" ADD CONSTRAINT "HomeworkCheckResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "HomeworkCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkCheckResult" ADD CONSTRAINT "HomeworkCheckResult_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
