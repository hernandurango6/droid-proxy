import assert from "node:assert/strict";
import { test } from "node:test";
import { SERVICE_PACKAGE_NAME, isServicePackageReady } from "../index";

test("service package scaffold is ready", () => {
  assert.equal(SERVICE_PACKAGE_NAME, "@droidproxy/service");
  assert.equal(isServicePackageReady(), true);
});