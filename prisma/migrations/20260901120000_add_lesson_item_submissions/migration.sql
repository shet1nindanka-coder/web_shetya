-- Сдачи классной работы: фото решения одного номера урока + результат
-- ИИ-проверки. Enum'ы SolutionCheckStatus/SolutionVerdict переиспользуются
-- из миграции автопроверки ДЗ. Стиль fail-loud: без IF NOT EXISTS.

CREATE TABLE "LessonItemSubmission" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" "SolutionCheckStatus" NOT NULL DEFAULT 'PENDING',
    "activeSlot" INTEGER DEFAULT 1,
    "verdict" "SolutionVerdict",
    "recognizedAnswer" TEXT,
    "comment" TEXT,
    "confidence" DOUBLE PRECISION,
    "errorKind" TEXT,
    "errorNote" TEXT,
    "injectionSuspected" BOOLEAN NOT NULL DEFAULT false,
    "injectionNote" TEXT,
    "modelUsed" TEXT,
    "error" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "LessonItemSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonItemSubmission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LessonAssignmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LessonItemSubmission_itemId_activeSlot_key" ON "LessonItemSubmission"("itemId", "activeSlot");
CREATE INDEX "LessonItemSubmission_itemId_submittedAt_idx" ON "LessonItemSubmission"("itemId", "submittedAt");

CREATE TABLE "LessonSubmissionPhoto" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "LessonSubmissionPhoto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonSubmissionPhoto_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LessonItemSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    -- Restrict, как у фото проверок ДЗ: файл нельзя удалить, пока он в сдаче.
    CONSTRAINT "LessonSubmissionPhoto_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "LessonSubmissionPhoto_submissionId_fileId_key" ON "LessonSubmissionPhoto"("submissionId", "fileId");
CREATE UNIQUE INDEX "LessonSubmissionPhoto_submissionId_order_key" ON "LessonSubmissionPhoto"("submissionId", "order");
CREATE INDEX "LessonSubmissionPhoto_fileId_idx" ON "LessonSubmissionPhoto"("fileId");
