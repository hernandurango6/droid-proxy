import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MINIMUM_BACKEND_VERSION,
  assertMinimumVersion,
  compareSemver,
  isBackendVersionSupported
} from "../version-check";

test("compareSemver orders versions correctly", () => {
  assert.equal(compareSemver("7.1.0", "7.0.9"), 1);
  assert.equal(compareSemver("7.1.0", "7.1.0"), 0);
  assert.equal(compareSemver("7.0.0", MINIMUM_BACKEND_VERSION), -1);
});

test("isBackendVersionSupported enforces minimum backend version", () => {
  assert.equal(isBackendVersionSupported("7.1.0"), true);
  assert.equal(isBackendVersionSupported("6.0.0"), false);
  assert.equal(isBackendVersionSupported(null), false);
});

test("assertMinimumVersion warns on unsupported versions", () => {
  const warnings: string[] = [];
  assert.equal(assertMinimumVersion("6.0.0", (message) => warnings.push(message)), "degraded");
  assert.equal(warnings.length, 1);
  assert.equal(assertMinimumVersion("7.2.0"), "ok");
});