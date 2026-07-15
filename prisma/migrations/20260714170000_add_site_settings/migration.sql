-- Настройки сайта, редактируемые из панели разработчика (/teacher/developer).
-- Значение из таблицы переопределяет env; env остаётся дефолтом (lib/site-settings.ts).
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);
