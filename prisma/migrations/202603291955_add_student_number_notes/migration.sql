ALTER TABLE "StudentTopicNumberStatus"
ALTER COLUMN "status" DROP NOT NULL;

ALTER TABLE "StudentTopicNumberStatus"
ADD COLUMN IF NOT EXISTS "note" TEXT;
