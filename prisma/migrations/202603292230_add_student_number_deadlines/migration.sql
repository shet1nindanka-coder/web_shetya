ALTER TABLE "StudentTopicNumberStatus"
ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StudentTopicNumberStatus_studentId_deadlineAt_idx"
ON "StudentTopicNumberStatus"("studentId", "deadlineAt");
