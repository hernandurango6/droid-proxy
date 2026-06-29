import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildCodexQuotaWindows,
  isCodexAuthFile,
  parseCodexQuotaSummary,
  parseCodexUsagePayload
} from "../providers/codex";

const fixtureDir = path.dirname(fileURLToPath(import.meta.url));
const codexUsageFixture = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "fixtures", "codex-usage.json"), "utf8")
);

test("parseCodexUsagePayload accepts JSON objects and strings", () => {
  assert.deepEqual(parseCodexUsagePayload(codexUsageFixture), codexUsageFixture);
  assert.deepEqual(parseCodexUsagePayload(JSON.stringify(codexUsageFixture)), codexUsageFixture);
  assert.equal(parseCodexUsagePayload(""), null);
});

test("buildCodexQuotaWindows maps primary and secondary windows", () => {
  const windows = buildCodexQuotaWindows(codexUsageFixture);
  assert.ok(windows.length >= 4);
  const fiveHour = windows.find((window) => window.id === "five-hour");
  assert.equal(fiveHour?.usedPercent, 45);
  assert.equal(fiveHour?.label, "5-hour window");
  const weekly = windows.find((window) => window.id === "weekly");
  assert.equal(weekly?.usedPercent, 12);
});

test("parseCodexQuotaSummary returns provider summary", () => {
  const summary = parseCodexQuotaSummary(codexUsageFixture);
  assert.ok(summary);
  assert.equal(summary?.provider, "codex");
  assert.equal(summary?.planType, "plus");
  assert.ok(summary!.windows.length > 0);
});

test("isCodexAuthFile recognizes codex auth files", () => {
  assert.equal(isCodexAuthFile({ type: "codex" }), true);
  assert.equal(isCodexAuthFile({ type: "claude" }), false);
});