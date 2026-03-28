-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "TheoryStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheoryTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheoryTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheoryAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" "TheoryStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "teacherComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TheoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkItem" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomeworkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkItemProgress" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkItemProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "TheoryTopic_displayOrder_idx" ON "TheoryTopic"("displayOrder");

-- CreateIndex
CREATE INDEX "TheoryAssignment_studentId_status_idx" ON "TheoryAssignment"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TheoryAssignment_studentId_topicId_key" ON "TheoryAssignment"("studentId", "topicId");

-- CreateIndex
CREATE INDEX "HomeworkItem_homeworkId_displayOrder_idx" ON "HomeworkItem"("homeworkId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkItem_homeworkId_number_key" ON "HomeworkItem"("homeworkId", "number");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_studentId_idx" ON "HomeworkAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAssignment_homeworkId_studentId_key" ON "HomeworkAssignment"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "HomeworkItemProgress_itemId_idx" ON "HomeworkItemProgress"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkItemProgress_assignmentId_itemId_key" ON "HomeworkItemProgress"("assignmentId", "itemId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryTopic" ADD CONSTRAINT "TheoryTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryAssignment" ADD CONSTRAINT "TheoryAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryAssignment" ADD CONSTRAINT "TheoryAssignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "TheoryTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkItem" ADD CONSTRAINT "HomeworkItem_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkItemProgress" ADD CONSTRAINT "HomeworkItemProgress_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkItemProgress" ADD CONSTRAINT "HomeworkItemProgress_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "HomeworkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
