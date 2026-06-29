import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  buildAntigravityQuotaGroups,
  formatAntigravityGroupDescription,
  formatAntigravityResetLabel
} from "../providers/antigravity-groups";

const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("buildAntigravityQuotaGroups preserves model groups and descriptions", () => {
  const payload = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, "antigravity-usage.json"), "utf8")
  );
  const groups = buildAntigravityQuotaGroups(payload);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.label, "Gemini models");
  assert.equal(
    formatAntigravityGroupDescription(groups[0]?.description),
    "Models in this group: Gemini Flash, Gemini Pro"
  );
  assert.equal(groups[1]?.buckets[0]?.label, "Weekly limit");
});

test("formatAntigravityResetLabel returns relative refresh copy", () => {
  const nowMs = Date.parse("2026-06-29T12:00:00.000Z");
  const label = formatAntigravityResetLabel("2026-07-06T20:49:36.000Z", nowMs);
  assert.match(label, /^Refreshes in /);
});