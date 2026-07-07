# CLAUDE.md

Guidance for AI agents working in this repository. Keep it current when architecture changes.

## What this project is

**TutorFlow MVP** — a full-stack tutoring platform with a Russian-language UI. A teacher publishes
**shared topics** (each with a theory file, a homework file, and a list of numbered problems). Each
**student** tracks their own per-problem progress with a traffic-light status, personal notes, and
deadlines. The teacher monitors every student's progress, sets deadlines, and can attach LaTeX
conditions/answers to individual problems.

**Core invariant:** topics and homework numbers are global/shared; *progress, notes and deadlines are
per-student*, keyed by `studentId + homeworkNumberId`. The same topic therefore shows different
progress for different students. Never attach a `Topic` to a single student.

## Stack

- Next.js 15 (App Router + Server Actions) · React 19 · TypeScript (strict) · Node 20
- Tailwind CSS 3 · PostgreSQL · Prisma 5
- Custom cookie-session auth (no NextAuth) · pino structured logging · @react-pdf/renderer (PDF-отчёты) · KaTeX (math)

Path alias: `@/*` → repo root (e.g. `import { requireUser } from "@/lib/auth"`).

## Commands

```bash
npm run dev          # next dev
npm run build        # prisma generate && next build
npm run start        # next start
npm run lint         # eslint, fails on any warning (--max-warnings=0)
npm run test         # tsx --test tests/**/*.test.ts  (pure logic, no DB)
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate deploy
npm run db:dev       # prisma migrate dev
npm run db:reset     # prisma migrate reset --force
npm run db:seed      # tsx prisma/seed.ts
```

Local DB: `docker compose up -d` runs Postgres on **port 5433** (not 5432, to avoid clashing with a
local install). Seed accounts: `teacher@example.com` / `teacher123`, and `ilya@example.com` /
`maria@example.com` / `student123`.

Before finishing a change, run `npm run lint` and `npm run test`. CI
(`.github/workflows/ci.yml`) runs lint + `prisma generate` + `migrate deploy` + `build` against a
Postgres service.

## Architecture — where things live

- **Routes** — `app/(auth)/` (login) and `app/(dashboard)/` (student + teacher shells) are route
  groups. `app/page.tsx` redirects to the role home or `/login`. Auth-dependent pages set
  `export const dynamic = "force-dynamic"`.
- **Reads** — all DB aggregation lives in `lib/platform-data.ts` (`getStudentTopicsOverview`,
  `getStudentTopicDetail`, `getTeacherTopicsOverview`, `getTeacherTopicDetail`,
  `getTeacherStudentDetail`, `getStudentDeadlines`, `getProgressTimeline`, `getDashboardSummary`,
  …), wrapped with Next cache tags. Pages are server components that call these — don't query Prisma
  directly from a page.
- **Writes — two mechanisms, pick deliberately:**
  - **Server actions** (`actions/*.ts`) for HTML form posts: `auth.ts` (login/logout),
    `topic.ts` (topic CRUD + file upload/replace/delete + student status), `student.ts`
    (teacher creates/deletes students), `profile.ts` (name + password). Pattern:
    `validate → mutate → revalidate → redirect("/path?error=… | saved=1")`. The UI reads the
    status from the query string; never throw an error to the user.
  - **API route handlers** (`app/api/**/route.ts`) for interactive client `fetch`/JSON:
    student status+note, teacher deadlines, homework assignments (`/api/teacher/homeworks`,
  POST/DELETE), LaTeX conditions, LaTeX answers, topic reorder,
    streak, number search, and pre-uploads. `app/files/[fileId]/route.ts` serves files;
    `app/(dashboard)/teacher/students/[studentId]/export/pdf/route.ts` builds the weekly PDF report.
- **Cache invalidation** — after every mutation call the helpers in `lib/platform-data-cache.ts`
  (`revalidateAllPlatformData`, `revalidateTeacherTopicsData`, `revalidateTeacherStudentsData`,
  `revalidateStudentTopicsData`) plus `revalidatePath(...)` for the affected routes.
- **Auth** — `lib/auth.ts`: `requireUser(role?)` (redirects to `/login` or the user's role home),
  `getCurrentUser`, `tryGetCurrentUser`. Cookie name `tutor_session`; tokens are random and stored
  hashed (sha256), passwords use scrypt (`lib/password.ts`). `middleware.ts` guards `/dashboard`,
  `/student`, `/teacher` (presence check only — real role checks happen in `requireUser`).
- **Realtime** — in-memory pub/sub `lib/dashboard-realtime.ts` → SSE endpoint
  `app/api/realtime/route.ts` → `EventSource` in `components/dashboard-realtime-listener.tsx`. The
  student streak has its own client-side event bus (`lib/student-streak-realtime.ts`).
- **Storage** — `lib/storage.ts` abstracts three backends. Backend is chosen by env:
  `BLOB_READ_WRITE_TOKEN` → Vercel Blob, else S3 config (`S3_*`, e.g. Yandex Object Storage), else
  local disk (`STORAGE_DIR`). Storage keys are prefixed (`blob:` / `s3:` / `local:`) so previously
  uploaded files keep resolving even if the configured backend changes. **Files are served only
  through the protected `/files/[fileId]` route** with `lib/file-access.ts` checks — never from
  `public/`. Allowed uploads: pdf, docx, png, jpg/jpeg. Server-action body limit is 15 MB
  (`next.config.ts`).
- **Domain helpers** — `lib/utils.ts`: `homeworkStatusMeta` (GREEN/YELLOW/RED labels + CSS classes),
  `roleHome`, `parseNumbersInput` (accepts lists and ranges like `"1-5, 7, 10"`), text
  normalizers, date/size formatters, MIME helpers, allowed-upload lists.
- **Rate limiting** — `lib/rate-limit.ts`, in-memory token bucket (login and student creation).
- **Logging** — `lib/logger.ts` (pino). Use `logInfoEvent` / `logWarnEvent` / `logErrorEvent(event,
  context, error?, message?)` with dotted event names, e.g. `topic.create.succeeded`,
  `auth.login.rate_limited`.

## Data model (`prisma/schema.prisma`)

- `User` — `role: TEACHER | STUDENT`, `email` (used as login), `passwordHash`.
- `Session` — server sessions for cookie auth (`tokenHash`, `expiresAt`).
- `StoredFile` — file metadata (`originalName`, `storageKey`, `mimeType`, `size`); reused across
  theory/homework/answer references, cleaned up when no longer referenced.
- `Topic` — shared topic: `title`, `description`, `displayOrder`, optional `theoryFile` /
  `homeworkFile`.
- `TopicHomeworkNumber` — a problem inside a topic: `number`, `displayOrder`, optional
  `conditionLatex`, `answerLatex`, `answerFile`. Unique on `(topicId, number)`.
- `StudentTopicNumberStatus` — per-student state: `status: GREEN | YELLOW | RED | null`, `note`,
  `deadlineAt`. Unique on `(studentId, homeworkNumberId)`.
- `HomeworkAssignment` + `HomeworkAssignmentNumber` — a homework set issued to one student for one
  topic (`title?`, `deadlineAt`, linked numbers). Issuing/cancelling also mirrors `deadlineAt` onto
  `StudentTopicNumberStatus`, so student views, deadline calendars and the PDF report keep working.
  Teacher UI: `/teacher/students/[studentId]` shows homework review/cancel (default tab) with an
  `/assign` sub-tab for issuing homework; there is no per-topic progress view for the teacher.
- `HomeworkSubmissionPhoto` — a solution photo a student attaches to an assignment (links
  `HomeworkAssignment` to `StoredFile`). Students upload via `/api/student/homework-submissions`
  (PNG/JPG, max 10 per assignment) on `/student/deadlines`; the teacher sees the gallery in the
  review tab. Files are served through `/files/[fileId]` with an ownership check for students.

`prisma/migrations/` reflects the feature history: init → shared topics/files → answer files →
LaTeX answers → student notes → student deadlines → LaTeX conditions.

## Conventions

- **All user-facing copy is Russian.** Keep new strings Russian.
- Status styling comes from `homeworkStatusMeta` / the `ui-status-*` classes — don't hardcode colors.
  Build class strings with `cx(...)`.
- Server-action results are surfaced via redirect query params (`?error=invalid`, `?saved=1`,
  `?studentCreated=1`, …), parsed by the destination page.
- Several API routes defensively detect missing `note` / `deadlineAt` / `conditionLatex` columns and
  degrade gracefully (so the app survives if a migration hasn't been applied). Preserve that handling
  when editing those routes.
- Tests are pure logic units (no DB, no network) under `tests/*.test.ts`, run with `tsx --test`.
  Add/extend tests when you change anything in `lib/`.

## Gotchas

- Realtime pub/sub **and** rate limiting are **in-memory** → correct only on a single instance.
  Horizontal scaling / serverless needs an external broker and shared store.
- Run `prisma generate` after any schema change (already wired into `build` and `postinstall`).
- Don't bypass the storage layer or serve uploads from `public/` — always go through `/files/[fileId]`.
- The repo root folder name is Cyrillic (`Сайт`); prefer the `@/` alias over relative path juggling.
