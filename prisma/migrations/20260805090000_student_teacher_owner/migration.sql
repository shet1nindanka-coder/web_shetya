-- У каждого учителя свои ученики (SEC-002/003): владелец ученика на User.
ALTER TABLE "User" ADD COLUMN "teacherId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_teacherId_idx" ON "User"("teacherId");

-- Существующие ученики привязываются к самому раннему учителю (решение владельца):
-- на момент миграции преподаватель в системе один.
UPDATE "User" SET "teacherId" = (
  SELECT "id" FROM "User" WHERE "role" = 'TEACHER' ORDER BY "createdAt" ASC LIMIT 1
) WHERE "role" = 'STUDENT';
