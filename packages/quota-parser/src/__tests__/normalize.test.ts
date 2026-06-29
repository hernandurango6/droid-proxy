import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeNumberValue, normalizePlanType, normalizeStringValue } from "../normalize";

test("normalize helpers coerce upstream quota values", () => {
  assert.equal(normalizeStringValue("  plus "), "plus");
  assert.equal(normalizeNumberValue("42"), 42);
  assert.equal(normalizePlanType("PLUS"), "plus");
});