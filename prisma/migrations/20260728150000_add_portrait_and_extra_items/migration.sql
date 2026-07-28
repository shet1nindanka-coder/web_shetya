-- ИИ-портрет ученика (досье для подбора уроков) и дополнительная часть урока.
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "aiPortrait" TEXT;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "portraitUpdatedAt" TIMESTAMP(3);
ALTER TABLE "LessonAssignmentItem" ADD COLUMN IF NOT EXISTS "isExtra" BOOLEAN NOT NULL DEFAULT false;
