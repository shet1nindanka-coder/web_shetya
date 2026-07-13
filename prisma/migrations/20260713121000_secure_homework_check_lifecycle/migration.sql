-- Existing in-flight checks were created without immutable photo snapshots.
-- Fail them closed so students can explicitly restart them after this migration.
UPDATE "HomeworkCheck"
SET
    "status" = 'FAILED',
    "error" = 'Проверка остановлена после обновления. Запустите её заново.',
    "checkedAt" = COALESCE("checkedAt", CURRENT_TIMESTAMP)
WHERE "status" IN ('PENDING', 'CHECKING');

-- Bring pre-existing history under the same per-student limit. Deleting checks
-- cascades their result rows; immutable photo rows do not exist yet at this point.
WITH ranked_completed AS (
    SELECT
        check_row."id",
        ROW_NUMBER() OVER (
            PARTITION BY assignment."studentId"
            ORDER BY check_row."createdAt" DESC, check_row."id" DESC
        ) AS history_position
    FROM "HomeworkCheck" AS check_row
    INNER JOIN "HomeworkAssignment" AS assignment
        ON assignment."id" = check_row."assignmentId"
    WHERE check_row."status" IN ('DONE', 'FAILED')
)
DELETE FROM "HomeworkCheck" AS check_row
USING ranked_completed
WHERE check_row."id" = ranked_completed."id"
  AND ranked_completed.history_position > 50;

-- A nullable constant slot gives PostgreSQL a portable partial-uniqueness guard:
-- active checks use 1, terminal checks release it to NULL.
ALTER TABLE "HomeworkCheck" ADD COLUMN "activeSlot" INTEGER;
UPDATE "HomeworkCheck" SET "activeSlot" = NULL;
ALTER TABLE "HomeworkCheck" ALTER COLUMN "activeSlot" SET DEFAULT 1;

CREATE UNIQUE INDEX "HomeworkCheck_assignmentId_activeSlot_key"
ON "HomeworkCheck"("assignmentId", "activeSlot");

ALTER TABLE "HomeworkCheck"
ADD CONSTRAINT "HomeworkCheck_active_lifecycle_check"
CHECK (
    ("status" IN ('PENDING', 'CHECKING') AND "activeSlot" IS NOT NULL AND "activeSlot" = 1)
    OR
    ("status" IN ('DONE', 'FAILED') AND "activeSlot" IS NULL)
);

-- Immutable references to the exact files submitted when a check is created.
CREATE TABLE "HomeworkCheckPhoto" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "HomeworkCheckPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeworkCheckPhoto_checkId_fileId_key"
ON "HomeworkCheckPhoto"("checkId", "fileId");

CREATE UNIQUE INDEX "HomeworkCheckPhoto_checkId_order_key"
ON "HomeworkCheckPhoto"("checkId", "order");

CREATE INDEX "HomeworkCheckPhoto_fileId_idx"
ON "HomeworkCheckPhoto"("fileId");

ALTER TABLE "HomeworkCheckPhoto"
ADD CONSTRAINT "HomeworkCheckPhoto_checkId_fkey"
FOREIGN KEY ("checkId") REFERENCES "HomeworkCheck"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HomeworkCheckPhoto"
ADD CONSTRAINT "HomeworkCheckPhoto_fileId_fkey"
FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
