import assert from "node:assert/strict";
import { test } from "node:test";
import { killOrphanedBackend } from "../backend";

test("killOrphanedBackend skips cleanup when disabled", async () => {
  const logs: string[] = [];
  await killOrphanedBackend({
    enabled: false,
    onLog: (line) => logs.push(line)
  });
  assert.match(logs[0], /Skipping global cli-proxy-api.exe cleanup/);
});