import assert from "node:assert/strict";
import { test } from "node:test";
import { buildQuotaAlerts, classifyQuotaUsage, dedupeQuotaAlerts } from "../alerts";

test("classifyQuotaUsage maps thresholds to alert levels", () => {
  assert.equal(classifyQuotaUsage(70), null);
  assert.equal(classifyQuotaUsage(80), "warn");
  assert.equal(classifyQuotaUsage(95), "critical");
  assert.equal(classifyQuotaUsage(100), "exhausted");
});

test("dedupeQuotaAlerts suppresses repeated alerts within four hours", () => {
  const now = new Date("2026-06-29T12:00:00.000Z");
  const alerts = buildQuotaAlerts({
    provider: "claude",
    accountName: "main.json",
    windows: [{ id: "five-hour", label: "Five-hour window", usedPercent: 82, resetLabel: "-" }],
    now
  });

  const first = dedupeQuotaAlerts(alerts, {}, 4 * 60 * 60 * 1000, now.getTime());
  assert.equal(first.alerts.length, 1);

  const second = dedupeQuotaAlerts(
    alerts,
    first.lastSentAt,
    4 * 60 * 60 * 1000,
    now.getTime() + 60_000
  );
  assert.equal(second.alerts.length, 0);
});