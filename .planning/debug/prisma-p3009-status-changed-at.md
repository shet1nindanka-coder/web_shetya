# Prisma P3009: `20260709120000_add_status_changed_at`

## Status

- Mode: diagnose only; no production command has been run.
- Confirmed: P3009 is caused by an unresolved failed migration record, which blocks later migrations.
- Not yet confirmed: the SQL error that created the failed record. It must be read from `_prisma_migrations.logs`.

## Repository evidence

The current migration contains two statements:

```sql
ALTER TABLE "StudentTopicNumberStatus" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
UPDATE "StudentTopicNumberStatus"
SET "statusChangedAt" = "updatedAt"
WHERE "status" IS NOT NULL;
```

Git history is significant:

- `682b39f`, committed `2026-07-09 07:18:43 UTC`, originally used `ADD COLUMN IF NOT EXISTS` and updated only null values. SHA-256: `f8ae762008cdfec56ba6e64e3fff5afaa8d1db0485f4aed5b36ef556a32599c3`.
- `fb03682`, committed `2026-07-09 08:05:54 UTC`, changed it to non-idempotent `ADD COLUMN` and unconditional backfill. Current SHA-256: `235ff82af4df62f58b63244f5d4385f89abc6bcd6a3873c4984c843c35151deb`.
- Production records the failed start at `2026-07-09 08:06:15 UTC`, about 21 seconds after the second commit timestamp.

This makes `column already exists` a strong hypothesis if the column was created by an earlier attempt, `db push`, or manual change. It is not proven until the stored checksum, logs, and actual column are inspected.

## Read-only production inspection

PM2 can remain online for these queries:

```bash
cd ~/web_shetya
npx prisma migrate status

sudo -u postgres psql -X -d tutorflow -v ON_ERROR_STOP=1 <<'SQL'
SELECT
  migration_name,
  checksum,
  started_at,
  finished_at,
  rolled_back_at,
  applied_steps_count,
  logs
FROM "_prisma_migrations"
WHERE migration_name = '20260709120000_add_status_changed_at'
ORDER BY started_at;

SELECT column_name, data_type, datetime_precision, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'StudentTopicNumberStatus'
  AND column_name = 'statusChangedAt';

-- This remains valid even when the column is absent.
SELECT
  COUNT(*) FILTER (WHERE status IS NOT NULL) AS rows_with_status,
  COUNT(*) FILTER (
    WHERE status IS NOT NULL
      AND (to_jsonb(s) ->> 'statusChangedAt') IS NULL
  ) AS rows_missing_backfill
FROM "StudentTopicNumberStatus" AS s;

SELECT
  to_regclass('public."RateLimitBucket"') AS rate_limit_bucket,
  to_regclass('public."HomeworkCheckPhoto"') AS homework_check_photo;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'HomeworkCheck'
  AND column_name = 'activeSlot';
SQL
```

Expected column shape: `timestamp without time zone`, precision `3`, nullable `YES`.

Interpretation:

- `logs` is authoritative for the failed attempt.
- Checksum `235ff...` means the current non-idempotent migration was attempted; `f8ae...` means the earlier idempotent version was attempted.
- No information-schema row means the column is absent.
- Present expected column plus zero missing rows means the intended end state is already present.
- Present expected column plus positive missing rows means the migration is partially complete.
- Unexpected type/nullability is separate drift: do not resolve before reconciling it.
- `applied_steps_count` is supporting evidence only; schema inspection is authoritative.

## Before any recovery write

Take a backup and deploy when no AI checks are active:

```bash
sudo -u postgres pg_dump -Fc tutorflow > ~/tutorflow-before-p3009-$(date +%Y%m%d-%H%M%S).dump
```

Stop PM2 immediately before writes. Chain recovery with `&&` so incompatible code is not restarted after a failure.

## Branch A: column absent

First understand and remove the cause from `logs` if it is still relevant (permissions, disk, timeout, and so on). Then replay from the start:

```bash
cd ~/web_shetya
pm2 stop shetya && npx prisma migrate resolve --rolled-back 20260709120000_add_status_changed_at && npm run db:migrate && pm2 restart shetya --update-env
pm2 status
```

Do not use `--applied`: that would preserve schema drift.

## Branch B: expected column present, backfill complete

Do not use `--rolled-back`, because the current non-idempotent `ADD COLUMN` would fail again. Reconcile history, then apply pending migrations:

```bash
cd ~/web_shetya
pm2 stop shetya && npx prisma migrate resolve --applied 20260709120000_add_status_changed_at && npm run db:migrate && pm2 restart shetya --update-env
pm2 status
```

## Branch C: expected column present, backfill incomplete

Complete only missing values, preserving legitimate non-null timestamps written since July 9:

```bash
cd ~/web_shetya
pm2 stop shetya
sudo -u postgres psql -X -d tutorflow -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
UPDATE "StudentTopicNumberStatus"
SET "statusChangedAt" = "updatedAt"
WHERE "status" IS NOT NULL
  AND "statusChangedAt" IS NULL;
COMMIT;
SQL
```

Verify before resolving:

```bash
sudo -u postgres psql -X -d tutorflow -v ON_ERROR_STOP=1 <<'SQL'
SELECT COUNT(*) AS rows_missing_backfill
FROM "StudentTopicNumberStatus"
WHERE "status" IS NOT NULL
  AND "statusChangedAt" IS NULL;
SQL
```

Only if the result is `0`:

```bash
npx prisma migrate resolve --applied 20260709120000_add_status_changed_at && npm run db:migrate && pm2 restart shetya --update-env
pm2 status
```

If the update or migration fails, leave PM2 stopped and do not mark the migration applied.

## Post-recovery verification

```bash
cd ~/web_shetya
npx prisma migrate status

sudo -u postgres psql -X -d tutorflow -v ON_ERROR_STOP=1 <<'SQL'
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260709120000_add_status_changed_at',
  '20260713120000_add_persistent_rate_limit',
  '20260713121000_secure_homework_check_lifecycle'
)
ORDER BY migration_name, started_at;

SELECT
  to_regclass('public."RateLimitBucket"') AS rate_limit_bucket,
  to_regclass('public."HomeworkCheckPhoto"') AS homework_check_photo;
SQL
```

Success: no pending/failed migration; both security tables exist; the two July 13 migrations have non-null `finished_at`; PM2 is online.

## Do not do

- Do not run `prisma migrate reset` in production.
- Do not directly edit/delete `_prisma_migrations` rows.
- Do not use `db push` to bypass history.
- Do not mark `--applied` while column/backfill is missing.
- Do not mark `--rolled-back` while the column exists unless the partial schema is first intentionally reverted.

## Prisma recovery semantics

Officially supported production paths are: mark the failed migration rolled back and replay after handling partial steps; or manually complete its intended end state and mark it applied. The original error is stored in `_prisma_migrations.logs`; `migrate deploy` remains blocked until the failed record is resolved.
