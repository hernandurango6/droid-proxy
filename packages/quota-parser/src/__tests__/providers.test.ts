import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseAntigravityQuotaSummary } from "../providers/antigravity";
import { parseClaudeQuotaSummary } from "../providers/claude";
import { parseCodexQuotaSummary } from "../providers/codex";
import { parseKimiQuotaSummary } from "../providers/kimi";
import { parseXaiQuotaSummary } from "../providers/xai";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8"));
}

test("parseClaudeQuotaSummary maps utilization windows", () => {
  const summary = parseClaudeQuotaSummary(loadFixture("claude-usage.json"));
  assert.ok(summary);
  const fiveHour = summary!.windows.find((window) => window.id === "five-hour");
  assert.equal(fiveHour?.usedPercent, 82);
});

test("parseAntigravityQuotaSummary converts remaining fraction to used percent", () => {
  const summary = parseAntigravityQuotaSummary(loadFixture("antigravity-usage.json"));
  assert.ok(summary);
  const fiveHour = summary!.windows.find((window) => window.id === "five-hour");
  assert.equal(fiveHour?.usedPercent, 95);
});

test("parseCodexQuotaSummary keeps upstream used percent mapping", () => {
  const summary = parseCodexQuotaSummary(loadFixture("codex-usage.json"));
  assert.ok(summary);
  const codeReview = summary!.windows.find((window) => window.id === "code-review-five-hour");
  assert.equal(codeReview?.usedPercent, 80);
});

test("parseKimiQuotaSummary computes used percent from usage rows", () => {
  const summary = parseKimiQuotaSummary(loadFixture("kimi-usage.json"));
  assert.ok(summary);
  const summaryRow = summary!.windows.find((window) => window.id === "summary");
  assert.equal(summaryRow?.usedPercent, 85);
  const limitRow = summary!.windows.find((window) => window.id === "limit-0");
  assert.equal(limitRow?.usedPercent, 96);
});

test("parseXaiQuotaSummary computes billing used percent", () => {
  const summary = parseXaiQuotaSummary(loadFixture("xai-billing.json"));
  assert.ok(summary);
  assert.equal(summary!.windows[0]?.usedPercent, 95);
});