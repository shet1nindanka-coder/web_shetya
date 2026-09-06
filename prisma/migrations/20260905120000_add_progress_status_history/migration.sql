CREATE TABLE "ProgressStatusEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studentId" TEXT NOT NULL,
    "homeworkNumberId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "previousStatus" "HomeworkNumberStatus",
    "requestedStatus" "HomeworkNumberStatus",
    "status" "HomeworkNumberStatus",
    "decision" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" "UserRole",
    "context" JSONB NOT NULL,
    CONSTRAINT "ProgressStatusEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressStatusEvent_studentId_homeworkNumberId_createdAt_id_idx" ON "ProgressStatusEvent"("studentId", "homeworkNumberId", "createdAt", "id");
CREATE INDEX "ProgressStatusEvent_homeworkNumberId_idx" ON "ProgressStatusEvent"("homeworkNumberId");
ALTER TABLE "ProgressStatusEvent" ADD CONSTRAINT "ProgressStatusEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressStatusEvent" ADD CONSTRAINT "ProgressStatusEvent_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
