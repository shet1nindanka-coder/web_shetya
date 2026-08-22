import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupStatistics, type GroupMemberActivity } from "@/lib/group-statistics";

const now = new Date("2026-08-22T12:00:00+03:00");

function member(overrides: Partial<GroupMemberActivity> & { id: string; name: string }): GroupMemberActivity {
  return {
    closed7: 0,
    closed30: 0,
    red30: 0,
    streak: 0,
    overdueHomeworks: 0,
    activeHomeworks: 0,
    lastActivityAt: null,
    ...overrides
  };
}

test("ранжирует по активности за 7 дней, затем за 30, затем по стрику", () => {
  const stats = buildGroupStatistics(
    [
      member({ id: "a", name: "Аня", closed7: 2, closed30: 20, lastActivityAt: now }),
      member({ id: "b", name: "Боря", closed7: 5, closed30: 8, lastActivityAt: now }),
      member({ id: "c", name: "Вера", closed7: 2, closed30: 20, streak: 3, lastActivityAt: now })
    ],
    now
  );

  assert.deepEqual(
    stats.members.map((row) => [row.rank, row.id]),
    [
      [1, "b"],
      [2, "c"],
      [3, "a"]
    ]
  );
  assert.equal(stats.mostActive?.id, "b");
  assert.equal(stats.leastActive?.id, "a");
});

test("топ не назначается, если активности нет или участник один", () => {
  const single = buildGroupStatistics([member({ id: "a", name: "Аня", closed7: 3 })], now);
  assert.equal(single.mostActive, null);
  assert.equal(single.leastActive, null);

  const idle = buildGroupStatistics([member({ id: "a", name: "Аня" }), member({ id: "b", name: "Боря" })], now);
  assert.equal(idle.mostActive, null);
  assert.equal(idle.leastActive?.id, "b");
});

test("флаги внимания: просрочка, простой от 7 дней, «ещё не начинал», много красных", () => {
  const stats = buildGroupStatistics(
    [
      member({ id: "a", name: "Аня", overdueHomeworks: 2, lastActivityAt: now }),
      member({ id: "b", name: "Боря", lastActivityAt: new Date("2026-08-10T12:00:00+03:00") }),
      member({ id: "c", name: "Вера" }),
      member({ id: "d", name: "Гена", red30: 5, lastActivityAt: now }),
      member({ id: "e", name: "Дима", closed7: 1, lastActivityAt: new Date("2026-08-20T12:00:00+03:00") })
    ],
    now
  );
  const byId = Object.fromEntries(stats.members.map((row) => [row.id, row]));

  assert.deepEqual(byId.a.attention, ["просрочено ДЗ: 2"]);
  assert.deepEqual(byId.b.attention, ["без активности 12 дн."]);
  assert.equal(byId.b.idleDays, 12);
  assert.deepEqual(byId.c.attention, ["ещё не начинал"]);
  assert.equal(byId.c.idleDays, null);
  assert.deepEqual(byId.d.attention, ["красных за месяц: 5"]);
  assert.deepEqual(byId.e.attention, []);
  assert.equal(stats.totals.attentionCount, 4);
  assert.equal(stats.totals.overdueHomeworks, 2);
});
