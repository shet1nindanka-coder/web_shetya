-- CreateTable
CREATE TABLE "HomeworkSubmissionPhoto" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkSubmissionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeworkSubmissionPhoto_assignmentId_idx" ON "HomeworkSubmissionPhoto"("assignmentId");

-- CreateIndex
CREATE INDEX "HomeworkSubmissionPhoto_fileId_idx" ON "HomeworkSubmissionPhoto"("fileId");

-- AddForeignKey
ALTER TABLE "HomeworkSubmissionPhoto" ADD CONSTRAINT "HomeworkSubmissionPhoto_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmissionPhoto" ADD CONSTRAINT "HomeworkSubmissionPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
