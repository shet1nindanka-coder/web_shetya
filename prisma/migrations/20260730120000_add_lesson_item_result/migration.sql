-- Итог урока по номеру: учитель отмечает после занятия (решил / с ошибками / не решил),
-- итог зеркалится в StudentTopicNumberStatus. Идемпотентно из-за исторического дрейфа БД.
DO $$ BEGIN
  CREATE TYPE "LessonItemResult" AS ENUM ('SOLVED', 'PARTIAL', 'NOT_SOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "LessonAssignmentItem" ADD COLUMN IF NOT EXISTS "result" "LessonItemResult";
