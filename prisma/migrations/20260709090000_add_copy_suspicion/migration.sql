-- AlterTable
ALTER TABLE "HomeworkCheckResult" ADD COLUMN "copySuspected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "copyReason" TEXT;
