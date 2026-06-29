import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DASHBOARD_LOGIN_PROVIDERS,
  LOGIN_FLAGS,
  getLoginFlag,
  isLoginProvider
} from "../login-flags";

test("LOGIN_FLAGS match cli.js provider flags", () => {
  assert.equal(LOGIN_FLAGS.claude, "-claude-login");
  assert.equal(LOGIN_FLAGS.codex, "-codex-login");
  assert.equal(LOGIN_FLAGS["codex-device"], "-codex-device-login");
  assert.equal(LOGIN_FLAGS.gemini, "-login");
  assert.equal(LOGIN_FLAGS.xai, "-xai-login");
});

test("dashboard providers are a subset of LOGIN_FLAGS", () => {
  for (const provider of DASHBOARD_LOGIN_PROVIDERS) {
    assert.ok(isLoginProvider(provider));
    assert.equal(getLoginFlag(provider), LOGIN_FLAGS[provider]);
  }
});

test("codex-device is CLI-only in v1", () => {
  assert.ok(isLoginProvider("codex-device"));
  assert.equal(DASHBOARD_LOGIN_PROVIDERS.includes("codex-device" as never), false);
});