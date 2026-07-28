-- Уроки, группы и профили учеников (ИИ-подбор заданий на урок).
--
-- Эта миграция приводит БД в соответствие со schema.prisma, которая давно ушла
-- вперёд базы. ВАЖНО: обе базы (локальная и прод) в прошлом чинились через
-- `prisma db push`, поэтому часть таблиц/колонок/энумов уже может существовать
-- в неизвестной комбинации. Это осознанное исключение из правила fail-loud:
-- миграция написана идемпотентно (IF NOT EXISTS / duplicate_object), потому что
-- её задача — свести исторический дрейф к единому состоянию, а не поймать новый.

-- ── Энумы ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "Subject" AS ENUM ('MATH', 'INFORMATICS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'ACTIVE', 'FINISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceStatus" AS ENUM ('UNKNOWN', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TestKind" AS ENUM ('PLACEMENT', 'LESSON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssignmentReason" AS ENUM ('NEW', 'REVIEW', 'GAP', 'DIAGNOSTIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Topic: subject / grade / пререквизиты ────────────────────────────────────
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "subject" "Subject" NOT NULL DEFAULT 'MATH';
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "grade" INTEGER;
CREATE INDEX IF NOT EXISTS "Topic_subject_grade_idx" ON "Topic"("subject", "grade");

CREATE TABLE IF NOT EXISTS "_TopicPrereqs" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TopicPrereqs_A_fkey" FOREIGN KEY ("A") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_TopicPrereqs_B_fkey" FOREIGN KEY ("B") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "_TopicPrereqs_AB_unique" ON "_TopicPrereqs"("A", "B");
CREATE INDEX IF NOT EXISTS "_TopicPrereqs_B_index" ON "_TopicPrereqs"("B");

-- ── Группы ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StudentGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" "Subject" NOT NULL DEFAULT 'MATH',
    "grade" INTEGER,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentGroup_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentGroup_teacherId_idx" ON "StudentGroup"("teacherId");

-- ── Профиль ученика ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" "Subject",
    "grade" INTEGER,
    "levelScore" INTEGER,
    "placedAt" TIMESTAMP(3),
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "speed" INTEGER,
    "aiNote" TEXT,
    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentProfile_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_userId_key" ON "StudentProfile"("userId");
CREATE INDEX IF NOT EXISTS "StudentProfile_groupId_idx" ON "StudentProfile"("groupId");
-- Новые поля (таблица могла существовать от db push без них):
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "speed" INTEGER;
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "aiNote" TEXT;

-- ── Уроки ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Lesson" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" "Subject" NOT NULL DEFAULT 'MATH',
    "teacherId" TEXT NOT NULL,
    "groupId" TEXT,
    "topicId" TEXT,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "startsAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "planParams" JSONB,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudentGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Lesson_teacherId_idx" ON "Lesson"("teacherId");
CREATE INDEX IF NOT EXISTS "Lesson_groupId_idx" ON "Lesson"("groupId");
CREATE INDEX IF NOT EXISTS "Lesson_status_idx" ON "Lesson"("status");
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "planParams" JSONB;

-- ── Участники урока ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LessonParticipant" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "joinedAt" TIMESTAMP(3),
    "queueOrder" INTEGER,
    "helpedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "speed" INTEGER,
    "planSummary" TEXT,
    "planGeneratedAt" TIMESTAMP(3),
    "planError" TEXT,
    CONSTRAINT "LessonParticipant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonParticipant_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LessonParticipant_lessonId_studentId_key" ON "LessonParticipant"("lessonId", "studentId");
CREATE INDEX IF NOT EXISTS "LessonParticipant_lessonId_queueOrder_idx" ON "LessonParticipant"("lessonId", "queueOrder");
CREATE INDEX IF NOT EXISTS "LessonParticipant_studentId_idx" ON "LessonParticipant"("studentId");
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "speed" INTEGER;
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "planSummary" TEXT;
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "planGeneratedAt" TIMESTAMP(3);
ALTER TABLE "LessonParticipant" ADD COLUMN IF NOT EXISTS "planError" TEXT;

-- ── Задания урока ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LessonAssignmentItem" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "homeworkNumberId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "reason" "AssignmentReason" NOT NULL DEFAULT 'NEW',
    "forReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutes" INTEGER,
    "comment" TEXT,
    CONSTRAINT "LessonAssignmentItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonAssignmentItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "LessonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LessonAssignmentItem_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LessonAssignmentItem_participantId_homeworkNumberId_key" ON "LessonAssignmentItem"("participantId", "homeworkNumberId");
CREATE INDEX IF NOT EXISTS "LessonAssignmentItem_participantId_order_idx" ON "LessonAssignmentItem"("participantId", "order");
CREATE INDEX IF NOT EXISTS "LessonAssignmentItem_homeworkNumberId_idx" ON "LessonAssignmentItem"("homeworkNumberId");
ALTER TABLE "LessonAssignmentItem" ADD COLUMN IF NOT EXISTS "minutes" INTEGER;
ALTER TABLE "LessonAssignmentItem" ADD COLUMN IF NOT EXISTS "comment" TEXT;

-- ── Освоение тем ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "TopicMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "mastered" BOOLEAN NOT NULL DEFAULT false,
    "masteredAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TopicMastery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TopicMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicMastery_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TopicMastery_studentId_topicId_key" ON "TopicMastery"("studentId", "topicId");
CREATE INDEX IF NOT EXISTS "TopicMastery_topicId_idx" ON "TopicMastery"("topicId");

-- ── Тесты (пустые таблицы для соответствия схеме; кода под них нет) ──────────
CREATE TABLE IF NOT EXISTS "Test" (
    "id" TEXT NOT NULL,
    "kind" "TestKind" NOT NULL,
    "title" TEXT NOT NULL,
    "subject" "Subject" NOT NULL DEFAULT 'MATH',
    "lessonId" TEXT,
    "topicId" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Test_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Test_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Test_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Test_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Test_lessonId_idx" ON "Test"("lessonId");
CREATE INDEX IF NOT EXISTS "Test_kind_idx" ON "Test"("kind");

CREATE TABLE IF NOT EXISTS "TestQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "homeworkNumberId" TEXT,
    "promptLatex" TEXT,
    "correctAnswer" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestQuestion_homeworkNumberId_fkey" FOREIGN KEY ("homeworkNumberId") REFERENCES "TopicHomeworkNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TestQuestion_testId_order_idx" ON "TestQuestion"("testId", "order");
CREATE INDEX IF NOT EXISTS "TestQuestion_homeworkNumberId_idx" ON "TestQuestion"("homeworkNumberId");

CREATE TABLE IF NOT EXISTS "TestAttempt" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "score" INTEGER,
    "maxScore" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    CONSTRAINT "TestAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TestAttempt_testId_studentId_key" ON "TestAttempt"("testId", "studentId");
CREATE INDEX IF NOT EXISTS "TestAttempt_studentId_idx" ON "TestAttempt"("studentId");

CREATE TABLE IF NOT EXISTS "TestAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT,
    "isCorrect" BOOLEAN,
    "awardedPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TestAnswer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TestAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TestAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TestAnswer_attemptId_questionId_key" ON "TestAnswer"("attemptId", "questionId");
CREATE INDEX IF NOT EXISTS "TestAnswer_questionId_idx" ON "TestAnswer"("questionId");
