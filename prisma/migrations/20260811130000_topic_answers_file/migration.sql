-- Файл ответов темы: третий файл рядом с теорией и заданиями, виден только
-- учителю и разработчику (ученикам закрыт в file-access).
ALTER TABLE "Topic" ADD COLUMN "answersFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_answersFileId_fkey" FOREIGN KEY ("answersFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
