import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Явно отдельная локальная БД; никогда не берём DATABASE_URL проекта как fallback.
const testUrl = process.env.PROGRESS_TEST_DATABASE_URL;

test("история прогресса: транзакции, конкуренция, завершение урока и права", { skip: !testUrl }, async (t) => {
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  assert.match(url.pathname, /^\/shbz_progress_[a-z0-9_]+_test$/);
  process.env.DATABASE_URL = url.toString();
  process.env.LOG_LEVEL = "silent";
  const { prisma } = await import("../lib/prisma");
  const { runProgressTransaction } = await import("../lib/progress-write");
  const { getProgressHistory } = await import("../lib/progress-history");
  const { finalizeLessonResults } = await import("../lib/lesson-finalize");
  const suffix = randomUUID();
  const teacher = await prisma.user.create({ data: { name: "Тест учителя", email: `teacher-${suffix}`, passwordHash: "test-only", role: "TEACHER" } });
  const student = await prisma.user.create({ data: { name: "Тест ученика", email: `student-${suffix}`, passwordHash: "test-only", role: "STUDENT", teacherId: teacher.id } });
  const topic = await prisma.topic.create({ data: { title: "Тест истории", description: "", homeworkNumbers: { create: [{ number: "001" }, { number: "002" }, { number: "003" }] } }, include: { homeworkNumbers: true } });
  const [number, attempted, untouched] = topic.homeworkNumbers;
  const key = { studentId: student.id, homeworkNumberId: number.id };
  const readStatus = () => prisma.studentTopicNumberStatus.findUnique({ where: { studentId_homeworkNumberId: key } });
  const eventCount = () => prisma.progressStatusEvent.count({ where: key });

  try {
    await t.test("статус, история и общий журнал содержат одну принятую отметку", async () => {
      await runProgressTransaction((_tx, write) => write({ ...key, source: "teacher", status: "RED", actor: teacher }));
      assert.equal((await readStatus())?.status, "RED");
      const event = await prisma.progressStatusEvent.findFirstOrThrow({ where: key });
      assert.equal(event.previousStatus, null);
      assert.equal(event.status, "RED");
      assert.equal(event.actorId, teacher.id);
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "progress.status", targetId: event.id } });
      assert.equal(audit.actorName, teacher.name);
    });

    await t.test("откат не оставляет ни новый статус, ни историю, ни ложный лог", async () => {
      const before = await eventCount();
      await assert.rejects(runProgressTransaction(async (_tx, write) => {
        await write({ ...key, source: "teacher", status: "GREEN", actor: teacher });
        throw new Error("forced rollback");
      }), /forced rollback/);
      assert.equal((await readStatus())?.status, "RED");
      assert.equal(await eventCount(), before);
      assert.equal(await prisma.auditLog.count({ where: { action: "progress.status", meta: { path: ["studentId"], equals: student.id } } }), before);
    });

    await t.test("отказ старой проверке записывает причину и сохраняет время ручной отметки", async () => {
      const previous = await readStatus();
      await runProgressTransaction((_tx, write) => write({
        ...key, source: "homework_check", verdict: "CORRECT", checkStartedAt: new Date(0),
        references: { checkId: "historical-check" }
      }));
      const after = await readStatus();
      assert.equal(after?.status, previous?.status);
      assert.deepEqual(after?.statusChangedAt, previous?.statusChangedAt);
      const history = await getProgressHistory(teacher, student.id, number.id);
      assert.match(history!.entries[0].reason, /после запуска/);
    });

    await t.test("одновременные записи повторяют конфликт, история образует честную цепочку", async () => {
      const before = await eventCount();
      let entered = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => { release = resolve; });
      const attempts = [0, 0];
      await Promise.all((["GREEN", null] as const).map((status, i) => runProgressTransaction(async (tx, write) => {
        attempts[i]++;
        // Фиксируем пересекающиеся снимки БД перед первой попыткой записи.
        await tx.studentTopicNumberStatus.findUnique({ where: { studentId_homeworkNumberId: key } });
        if (attempts[i] === 1) {
          if (++entered === 2) release();
          await barrier;
        }
        return write({ ...key, source: "teacher", status, actor: teacher });
      })));
      assert.ok(attempts.some((count) => count > 1));
      assert.equal(await eventCount(), before + 2);
      const events = await prisma.progressStatusEvent.findMany({ where: key, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2 });
      assert.equal(events[0].previousStatus, events[1].status);
      assert.equal((await readStatus())?.status, events[0].status);
      assert.equal(await prisma.auditLog.count({ where: { action: "progress.status", meta: { path: ["studentId"], equals: student.id } } }), before + 2);
    });

    await t.test("чужому учителю и ученику история закрыта, разработчику доступна", async () => {
      assert.equal(await getProgressHistory({ id: "other-teacher", role: "TEACHER" }, student.id, number.id), null);
      assert.equal(await getProgressHistory(student, student.id, number.id), null);
      assert.ok(await getProgressHistory({ id: "developer", role: "DEVELOPER" }, student.id, number.id));
    });

    await t.test("пагинация не теряет записи и не принимает курсор чужого номера", async () => {
      await runProgressTransaction(async (_tx, write) => {
        for (let i = 0; i < 22; i++) await write({ ...key, source: "teacher", status: i % 2 ? "RED" : "GREEN", actor: teacher });
      });
      const first = (await getProgressHistory(teacher, student.id, number.id))!;
      assert.equal(first.entries.length, 20);
      assert.ok(first.nextCursor);
      const second = (await getProgressHistory(teacher, student.id, number.id, first.nextCursor!))!;
      assert.ok(second.entries.length > 0);
      assert.equal(new Set([...first.entries, ...second.entries].map((event) => event.id)).size, await eventCount());
      assert.equal(await getProgressHistory(teacher, student.id, attempted.id, first.nextCursor!), null);
    });

    await t.test("завершение урока атомарно сохраняет итоги, прогресс и историю, повтор безопасен", async () => {
      const lesson = await prisma.lesson.create({ data: {
        title: "Завершённый тестовый урок", teacherId: teacher.id,
        startsAt: new Date(Date.now() - 120 * 60_000), durationMinutes: 60,
        participants: { create: { studentId: student.id, items: { create: [
          { homeworkNumberId: attempted.id, submissions: { create: { status: "DONE", activeSlot: null, verdict: "UNCERTAIN" } } },
          { homeworkNumberId: untouched.id }
        ] } } }
      } });
      const result = await finalizeLessonResults(lesson.id);
      assert.deepEqual(result, { finalized: true, notSolved: 1, skipped: 1 });
      const entries = await prisma.progressStatusEvent.findMany({ where: { studentId: student.id, source: "lesson_end" } });
      assert.equal(entries.length, 2);
      assert.equal(entries.find((event) => event.homeworkNumberId === attempted.id)?.status, "RED");
      assert.equal(entries.find((event) => event.homeworkNumberId === untouched.id)?.decision, "no_status");
      assert.equal(await prisma.studentTopicNumberStatus.count({ where: { studentId: student.id, homeworkNumberId: untouched.id } }), 0);
      assert.equal((await finalizeLessonResults(lesson.id)).finalized, false);
      assert.equal(await prisma.progressStatusEvent.count({ where: { studentId: student.id, source: "lesson_end" } }), 2);
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [student.id, teacher.id] } } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.auditLog.deleteMany({ where: { action: "progress.status", meta: { path: ["studentId"], equals: student.id } } });
    await prisma.$disconnect();
  }
});
