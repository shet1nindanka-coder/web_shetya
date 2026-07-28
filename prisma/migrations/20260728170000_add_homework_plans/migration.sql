-- ИИ-выдача ДЗ: Lesson становится контейнером двух видов планов (kind),
-- у плана-ДЗ появляется дедлайн, у участника — ссылка на выданное HomeworkAssignment.
DO $$ BEGIN
  CREATE TYPE "LessonKind" AS ENUM ('LESSON', 'HOMEWORK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "kind" "LessonKind" NOT NULL DEFAULT 'LESSON';
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "deadlineAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Lesson_kind_idx" ON "Lesson"("kind");

-- issuedAssignmentId сознательно без FK: отмена ДЗ не должна каскадом трогать черновик.
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "issuedAssignmentId" TEXT;
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3);
