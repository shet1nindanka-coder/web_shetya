import test from "node:test";
import assert from "node:assert/strict";
import { buildWeekBuckets, countByWeek, mondayOf } from "../lib/week-buckets";

test("mondayOf возвращает понедельник 00:00 текущей недели", () => {
  // 21 августа 2026 — пятница; понедельник той недели — 17 августа.
  const friday = new Date(2026, 7, 21, 15, 30);
  const monday = mondayOf(friday);

  assert.equal(monday.getFullYear(), 2026);
  assert.equal(monday.getMonth(), 7);
  assert.equal(monday.getDate(), 17);
  assert.equal(monday.getHours(), 0);
  assert.equal(monday.getMinutes(), 0);

  // Понедельник остаётся своим же понедельником.
  assert.equal(mondayOf(monday).getTime(), monday.getTime());

  // Воскресенье относится к неделе прошедшего понедельника, а не следующего.
  const sunday = new Date(2026, 7, 23, 23, 59);
  assert.equal(mondayOf(sunday).getDate(), 17);
});

test("buildWeekBuckets: последние N недель от старой к новой, текущая — последняя", () => {
  const now = new Date(2026, 7, 21, 12, 0);
  const buckets = buildWeekBuckets(now, 4);

  assert.equal(buckets.length, 4);
  assert.equal(buckets[3].start.getDate(), 17); // текущая неделя
  assert.equal(buckets[2].start.getDate(), 10);
  assert.equal(buckets[1].start.getDate(), 3);
  assert.equal(buckets[0].start.getDate(), 27); // 27 июля
  assert.equal(buckets[0].start.getMonth(), 6);

  for (const bucket of buckets) {
    assert.equal(bucket.end.getTime() - bucket.start.getTime(), 7 * 24 * 60 * 60 * 1000);
  }
});

test("countByWeek раскладывает даты по корзинам, границы — [start, end)", () => {
  const now = new Date(2026, 7, 21, 12, 0);
  const buckets = buildWeekBuckets(now, 3); // 3, 10, 17 августа

  const counts = countByWeek(
    [
      new Date(2026, 7, 3, 0, 0), // ровно старт первой корзины → входит
      new Date(2026, 7, 9, 23, 59), // конец первой недели → входит в первую
      new Date(2026, 7, 10, 0, 0), // ровно старт второй → входит во вторую
      new Date(2026, 7, 21, 18, 0), // текущая неделя
      new Date(2026, 6, 1, 12, 0), // старше диапазона → не считается
      new Date(2026, 7, 24, 0, 0) // следующая неделя (будущее) → не считается
    ],
    buckets
  );

  assert.deepEqual(counts, [2, 1, 1]);
});
