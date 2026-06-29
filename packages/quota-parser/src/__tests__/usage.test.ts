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
import type { ApiCallRequest, ApiCallResult } from "../poller";
import type { AuthFileItem } from "../auth-files";
import { collectQuotaUsage } from "../usage";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

const authFiles: AuthFileItem[] = [
  { name: "claude-main.json", type: "claude", auth_index: "1" },
  { name: "codex-main.json", type: "codex", auth_index: "2" },
  { name: "agy-main.json", type: "antigravity", auth_index: "3", project_id: "proj-1" },
  { name: "kimi-main.json", type: "kimi", auth_index: "4" },
  { name: "xai-main.json", type: "xai", auth_index: "5" }
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

test("collectQuotaUsage returns account windows and derived alerts", async () => {
  const fixedNow = new Date("2026-06-29T12:00:00.000Z");
  const result = await collectQuotaUsage(
    {
      listAuthFiles: async () => authFiles,
      apiCall: mockApiCall
    },
    { now: fixedNow }
  );

  assert.equal(result.accounts.length, 5);
  assert.ok(result.alerts.length >= 5);

  const claude = result.accounts.find((account) => account.accountName === "claude-main.json");
  assert.equal(claude?.status, "success");
  assert.ok((claude?.windows.length ?? 0) > 0);

  const codex = result.accounts.find((account) => account.accountName === "codex-main.json");
  assert.equal(codex?.status, "success");
  assert.equal(codex?.planType, "plus");
});