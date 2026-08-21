-- Журнал звонков родителям (фаза «звонки родителям»): append-only история
-- по каждому ученику. Напоминание «пора созвониться» считается в коде от
-- последнего звонка с исходом REACHED; NO_ANSWER — зафиксированная попытка,
-- якорь не двигает. Комментарий — персональные данные: доступ только
-- учителю-владельцу ученика и роли DEVELOPER, в логи не пишется.

CREATE TYPE "ParentCallOutcome" AS ENUM ('REACHED', 'NO_ANSWER');

CREATE TABLE "ParentCallLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT,
    "outcome" "ParentCallOutcome" NOT NULL,
    "comment" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentCallLog_studentId_calledAt_idx" ON "ParentCallLog"("studentId", "calledAt");

CREATE INDEX "ParentCallLog_teacherId_calledAt_idx" ON "ParentCallLog"("teacherId", "calledAt");

ALTER TABLE "ParentCallLog"
    ADD CONSTRAINT "ParentCallLog_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ParentCallLog"
    ADD CONSTRAINT "ParentCallLog_teacherId_fkey"
    FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
