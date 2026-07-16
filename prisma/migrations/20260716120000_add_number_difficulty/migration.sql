-- Этап 1 рекомендательной системы: сложность номеров.
-- Колонки difficulty/estimatedMinutes/usableInDiagnostic давно описаны в schema.prisma,
-- но миграции под них не было. difficultySource: 'ai' | 'manual' — ручная разметка
-- защищена от перезаписи ИИ.
ALTER TABLE "TopicHomeworkNumber" ADD COLUMN "difficulty" INTEGER;
ALTER TABLE "TopicHomeworkNumber" ADD COLUMN "estimatedMinutes" INTEGER;
ALTER TABLE "TopicHomeworkNumber" ADD COLUMN "usableInDiagnostic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TopicHomeworkNumber" ADD COLUMN "difficultySource" TEXT;

CREATE INDEX "TopicHomeworkNumber_usableInDiagnostic_idx" ON "TopicHomeworkNumber"("usableInDiagnostic");
