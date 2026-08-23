-- Журнал действий для панели разработчика: кто, что и когда вызвал.
-- Стиль fail-loud: без IF NOT EXISTS, дрейф схемы должен всплывать.

CREATE TYPE "AuditCategory" AS ENUM ('AI', 'DATA', 'AUTH');

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "AuditCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" "UserRole",
    "targetType" TEXT,
    "targetId" TEXT,
    "targetLabel" TEXT,
    "summary" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "costRub" DECIMAL(12,4),
    "durationMs" INTEGER,
    "error" TEXT,
    "meta" JSONB,
    "clientIp" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_category_createdAt_idx" ON "AuditLog"("category", "createdAt");
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- Удаление пользователя не должно стирать историю его действий: связь
-- обнуляется, а actorName/actorRole остаются снимком на момент события.
ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
