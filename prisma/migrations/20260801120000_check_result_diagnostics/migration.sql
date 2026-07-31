-- Служебный слой автопроверки: диагноз ошибки для ИИ-подбора (ученику не показывается)
-- и пометка о надписи-инструкции на фото (prompt injection).
ALTER TABLE "HomeworkCheckResult"
  ADD COLUMN "errorKind" TEXT,
  ADD COLUMN "errorNote" TEXT,
  ADD COLUMN "injectionSuspected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "injectionNote" TEXT;
