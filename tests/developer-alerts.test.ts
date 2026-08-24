import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDeveloperAlerts, DEVELOPER_ALERT_TYPES, type DeveloperAlertFacts } from "@/lib/developer-alerts";

const NOW = new Date("2026-08-24T12:00:00+03:00");

function facts(overrides: Partial<DeveloperAlertFacts> = {}): DeveloperAlertFacts {
  return {
    failedCount: 0,
    failedSinceLastAlert: 0,
    checksLastDay: 0,
    aiDailyLimit: 300,
    staleCheckCount: 0,
    storageBytes: 0,
    lastSentAt: {},
    now: NOW,
    ...overrides
  };
}

test("тихая платформа — уведомлений нет", () => {
  assert.deepEqual(resolveDeveloperAlerts(facts()), []);
});

test("ошибки за сутки дают уведомление со ссылкой на журнал ошибок", () => {
  const alerts = resolveDeveloperAlerts(facts({ failedCount: 4, failedSinceLastAlert: 4 }));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, DEVELOPER_ALERT_TYPES.errors);
  assert.match(alerts[0].title, /4 за сутки/);
  assert.match(alerts[0].href, /outcome=failed/);
});

test("ошибки без новых после последнего уведомления не дублируются", () => {
  const alerts = resolveDeveloperAlerts(
    facts({
      failedCount: 4,
      failedSinceLastAlert: 0,
      lastSentAt: { [DEVELOPER_ALERT_TYPES.errors]: new Date(NOW.getTime() - 8 * 60 * 60_000) }
    })
  );
  assert.deepEqual(alerts, []);
});

test("кулдаун ошибок: свежее уведомление глушит повтор даже при новых ошибках", () => {
  const alerts = resolveDeveloperAlerts(
    facts({
      failedCount: 6,
      failedSinceLastAlert: 2,
      lastSentAt: { [DEVELOPER_ALERT_TYPES.errors]: new Date(NOW.getTime() - 60_000) }
    })
  );
  assert.deepEqual(alerts, []);
});

test("бюджет от 80% — предупреждение, при 100% — только эскалация", () => {
  const warn = resolveDeveloperAlerts(facts({ checksLastDay: 240 }));
  assert.equal(warn.length, 1);
  assert.equal(warn[0].type, DEVELOPER_ALERT_TYPES.budgetWarn);

  const out = resolveDeveloperAlerts(facts({ checksLastDay: 300 }));
  assert.equal(out.length, 1);
  assert.equal(out[0].type, DEVELOPER_ALERT_TYPES.budgetOut);
});

test("бюджет ниже 80% молчит", () => {
  assert.deepEqual(resolveDeveloperAlerts(facts({ checksLastDay: 239 })), []);
});

test("зависшие проверки и хранилище дают свои уведомления", () => {
  const alerts = resolveDeveloperAlerts(
    facts({ staleCheckCount: 2, storageBytes: 700 * 1024 * 1024 })
  );
  assert.deepEqual(
    alerts.map((alert) => alert.type),
    [DEVELOPER_ALERT_TYPES.staleChecks, DEVELOPER_ALERT_TYPES.storage]
  );
});

test("кулдаун хранилища — неделя", () => {
  const fresh = resolveDeveloperAlerts(
    facts({
      storageBytes: 700 * 1024 * 1024,
      lastSentAt: { [DEVELOPER_ALERT_TYPES.storage]: new Date(NOW.getTime() - 6 * 24 * 60 * 60_000) }
    })
  );
  assert.deepEqual(fresh, []);

  const stale = resolveDeveloperAlerts(
    facts({
      storageBytes: 700 * 1024 * 1024,
      lastSentAt: { [DEVELOPER_ALERT_TYPES.storage]: new Date(NOW.getTime() - 8 * 24 * 60 * 60_000) }
    })
  );
  assert.equal(stale.length, 1);
});
