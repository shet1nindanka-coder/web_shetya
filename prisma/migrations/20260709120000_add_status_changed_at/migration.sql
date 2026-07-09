-- Отдельная метка времени смены статуса. updatedAt (@updatedAt) бампается любым
-- апдейтом строки — в т.ч. зеркалированием дедлайна при выдаче ДЗ и правке дедлайна,
-- из-за чего таймлайн активности и стрик приписывали «решение» не к тому дню.
-- Таймлайн/стрик/PDF теперь группируют по statusChangedAt (см. lib/platform-data.ts,
-- lib/student-export-data.ts, .../export/pdf/route.ts).
-- AlterTable
ALTER TABLE "StudentTopicNumberStatus" ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- Backfill: у уже отмеченных номеров берём updatedAt как приближение даты решения.
UPDATE "StudentTopicNumberStatus"
SET "statusChangedAt" = "updatedAt"
WHERE "status" IS NOT NULL;
