import assert from "node:assert/strict";
import { test } from "node:test";
import { getDefaultManagementBaseUrl } from "../index";

test("default management base URL points to local backend API", () => {
  assert.equal(
    getDefaultManagementBaseUrl(),
    "http://127.0.0.1:8418/v0/management"
  );
});