-- Уведомления. Модель `Notification` есть в schema.prisma и полностью реализована
-- в коде (lib/notifications.ts, колокольчик у ученика, рассылка из дев-панели), но
-- таблицу когда-то создали локально через `db push` и миграцию не оформили
-- (ARCH-001 / PROD-003). На чистой базе `prisma migrate deploy` давал 24 таблицы
-- из 25, а обёртка getNotificationDelegate() глушила ошибку — фича молча не работала.
--
-- IF NOT EXISTS — потому что на боевой базе объект, скорее всего, уже создан
-- вручную: миграция должна применяться и там, и на чистой базе одинаково.

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey'
    ) THEN
        ALTER TABLE "Notification"
            ADD CONSTRAINT "Notification_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$$;
