import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { formatAccountsForCli, getAccounts } from "../list";

test("getAccounts reads oauth json files from auth dir", () => {
  const authDir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-auth-"));
  fs.writeFileSync(path.join(authDir, "claude-user.json"), JSON.stringify({
    type: "claude",
    email: "user@example.com"
  }));
  fs.writeFileSync(path.join(authDir, "notes.txt"), "ignore me");

  const accounts = getAccounts(authDir);
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].type, "claude");
  assert.equal(accounts[0].email, "user@example.com");
  assert.equal(accounts[0].file, "claude-user.json");
});

test("formatAccountsForCli renders tab-separated rows", () => {
  const text = formatAccountsForCli([
    { file: "a.json", type: "codex", email: "a@example.com", disabled: false },
    { file: "b.json", type: "gemini", email: "b@example.com", disabled: true }
  ]);

  assert.match(text, /codex\ta@example\.com\ta\.json/);
  assert.match(text, /gemini\tb@example\.com\tb\.json\tdisabled/);
});