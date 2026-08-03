import assert from "node:assert/strict";
import test from "node:test";
import { computeMirroredDeadlines, groupNumbersByDeadline } from "@/lib/homework-deadline-mirror";

const early = new Date("2026-09-10T18:00:00.000Z");
const late = new Date("2026-09-20T18:00:00.000Z");

test("номер без единого ДЗ теряет дедлайн", () => {
  const mirrored = computeMirroredDeadlines(["n1"], []);

  assert.equal(mirrored.get("n1"), null);
});

test("номер из одного ДЗ получает его дедлайн", () => {
  const mirrored = computeMirroredDeadlines(["n1"], [
    { deadlineAt: late, numbers: [{ homeworkNumberId: "n1" }] }
  ]);

  assert.equal(mirrored.get("n1")?.toISOString(), late.toISOString());
});

test("номер в двух ДЗ получает ближайший дедлайн, а не последний записанный", () => {
  const mirrored = computeMirroredDeadlines(["n1"], [
    { deadlineAt: late, numbers: [{ homeworkNumberId: "n1" }] },
    { deadlineAt: early, numbers: [{ homeworkNumberId: "n1" }] }
  ]);

  assert.equal(mirrored.get("n1")?.toISOString(), early.toISOString());
});

test("порядок ДЗ на результат не влияет", () => {
  const forward = computeMirroredDeadlines(["n1"], [
    { deadlineAt: early, numbers: [{ homeworkNumberId: "n1" }] },
    { deadlineAt: late, numbers: [{ homeworkNumberId: "n1" }] }
  ]);

  assert.equal(forward.get("n1")?.toISOString(), early.toISOString());
});

test("удаление одного ДЗ оставляет дедлайн второго (регрессия ARCH-011)", () => {
  // Было: отмена ДЗ с дедлайном `early` чистила поле по совпадению значения,
  // и номер оставался без срока, хотя лежал ещё в одном ДЗ с дедлайном `late`.
  const afterCancel = computeMirroredDeadlines(["n1"], [
    { deadlineAt: late, numbers: [{ homeworkNumberId: "n1" }] }
  ]);

  assert.equal(afterCancel.get("n1")?.toISOString(), late.toISOString());
});

test("ДЗ без дедлайна ничего не зеркалит", () => {
  const mirrored = computeMirroredDeadlines(["n1"], [
    { deadlineAt: null, numbers: [{ homeworkNumberId: "n1" }] }
  ]);

  assert.equal(mirrored.get("n1"), null);
});

test("чужие номера из того же ДЗ не попадают в результат", () => {
  const mirrored = computeMirroredDeadlines(["n1"], [
    { deadlineAt: early, numbers: [{ homeworkNumberId: "n1" }, { homeworkNumberId: "n2" }] }
  ]);

  assert.deepEqual(Array.from(mirrored.keys()), ["n1"]);
});

test("каждый запрошенный номер присутствует в результате", () => {
  const mirrored = computeMirroredDeadlines(["n1", "n2", "n3"], [
    { deadlineAt: early, numbers: [{ homeworkNumberId: "n2" }] }
  ]);

  assert.equal(mirrored.size, 3);
  assert.equal(mirrored.get("n1"), null);
  assert.equal(mirrored.get("n2")?.toISOString(), early.toISOString());
  assert.equal(mirrored.get("n3"), null);
});

test("номера с одинаковым дедлайном складываются в одну группу", () => {
  const groups = groupNumbersByDeadline(
    computeMirroredDeadlines(["n1", "n2", "n3"], [
      { deadlineAt: early, numbers: [{ homeworkNumberId: "n1" }, { homeworkNumberId: "n2" }] }
    ])
  );

  assert.equal(groups.length, 2);

  const withDeadline = groups.find((group) => group.deadlineAt !== null);
  const withoutDeadline = groups.find((group) => group.deadlineAt === null);

  assert.deepEqual(withDeadline?.numberIds, ["n1", "n2"]);
  assert.deepEqual(withoutDeadline?.numberIds, ["n3"]);
});

test("пустой список номеров даёт пустой результат", () => {
  assert.equal(computeMirroredDeadlines([], []).size, 0);
  assert.deepEqual(groupNumbersByDeadline(new Map()), []);
});
