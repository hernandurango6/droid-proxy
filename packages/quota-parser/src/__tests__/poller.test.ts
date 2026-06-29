import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  ANTIGRAVITY_QUOTA_URLS,
  CLAUDE_USAGE_URL,
  CODEX_USAGE_URL,
  KIMI_USAGE_URL,
  XAI_BILLING_URL
} from "../constants";
import { collectQuotaAlerts, type ApiCallRequest, type ApiCallResult } from "../poller";
import type { AuthFileItem } from "../auth-files";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

const authFiles: AuthFileItem[] = [
  { name: "claude-main.json", type: "claude", auth_index: "1" },
  { name: "codex-main.json", type: "codex", auth_index: "2" },
  { name: "agy-main.json", type: "antigravity", auth_index: "3", project_id: "proj-1" },
  { name: "kimi-main.json", type: "kimi", auth_index: "4" },
  { name: "xai-main.json", type: "xai", auth_index: "5" },
  { name: "claude-disabled.json", type: "claude", auth_index: "6", disabled: true }
];

const fixtureByUrl: Record<string, unknown> = {
  [CLAUDE_USAGE_URL]: loadFixture("claude-usage.json"),
  [CODEX_USAGE_URL]: loadFixture("codex-usage.json"),
  [ANTIGRAVITY_QUOTA_URLS[0]]: loadFixture("antigravity-usage.json"),
  [KIMI_USAGE_URL]: loadFixture("kimi-usage.json"),
  [XAI_BILLING_URL]: loadFixture("xai-billing.json")
};

async function mockApiCall(request: ApiCallRequest): Promise<ApiCallResult> {
  const body = fixtureByUrl[request.url];
  if (!body) {
    return { statusCode: 404, error: "fixture not found" };
  }
  return { statusCode: 200, body };
}

test("collectQuotaAlerts emits expected alerts from mocked api-call fixtures", async () => {
  const fixedNow = new Date("2026-06-29T12:00:00.000Z");
  const { alerts } = await collectQuotaAlerts(
    {
      listAuthFiles: async () => authFiles,
      apiCall: mockApiCall
    },
    { now: fixedNow }
  );

  assert.ok(alerts.length >= 5);

  const claudeWarn = alerts.find(
    (alert) => alert.provider === "claude" && alert.accountName === "claude-main.json"
  );
  assert.equal(claudeWarn?.level, "warn");
  assert.equal(claudeWarn?.usedPercent, 82);

  const codexWarn = alerts.find(
    (alert) =>
      alert.provider === "codex" &&
      alert.accountName === "codex-main.json" &&
      alert.windowLabel === "Code review 5-hour window"
  );
  assert.equal(codexWarn?.level, "warn");
  assert.equal(codexWarn?.usedPercent, 80);

  const agyCritical = alerts.find(
    (alert) => alert.provider === "antigravity" && alert.accountName === "agy-main.json"
  );
  assert.equal(agyCritical?.level, "critical");
  assert.equal(agyCritical?.usedPercent, 95);

  const kimiWarn = alerts.find(
    (alert) => alert.provider === "kimi" && alert.accountName === "kimi-main.json" && alert.usedPercent === 85
  );
  assert.ok(kimiWarn);
  assert.equal(kimiWarn?.level, "warn");

  const kimiCritical = alerts.find(
    (alert) => alert.provider === "kimi" && alert.usedPercent === 96
  );
  assert.equal(kimiCritical?.level, "critical");

  const xaiCritical = alerts.find(
    (alert) => alert.provider === "xai" && alert.accountName === "xai-main.json"
  );
  assert.equal(xaiCritical?.level, "critical");
  assert.equal(xaiCritical?.usedPercent, 95);

  const disabled = alerts.find((alert) => alert.accountName === "claude-disabled.json");
  assert.equal(disabled, undefined);
});