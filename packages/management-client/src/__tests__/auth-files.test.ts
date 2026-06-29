import assert from "node:assert/strict";
import { test } from "node:test";
import { ManagementClient } from "../client";
import { listAuthFiles } from "../auth-files";

test("listAuthFiles normalizes array and wrapped payloads", async () => {
  const client = new ManagementClient({
    baseUrl: "http://127.0.0.1:8418/v0/management",
    secretKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({
      data: [{ name: "codex-user.json", type: "codex", auth_index: "0" }]
    }), { status: 200 })
  });

  const files = await listAuthFiles(client);
  assert.equal(files.length, 1);
  assert.equal(files[0].name, "codex-user.json");
  assert.equal(files[0].auth_index, "0");
});