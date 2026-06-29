import assert from "node:assert/strict";
import { test } from "node:test";
import { ManagementClient } from "../client";
import { getManagementVersion } from "../version";

test("getManagementVersion reads version field from JSON payload", async () => {
  const client = new ManagementClient({
    baseUrl: "http://127.0.0.1:8418/v0/management",
    secretKey: "secret-key",
    fetchImpl: async () => new Response(JSON.stringify({ version: "7.1.0" }), { status: 200 })
  });

  assert.equal(await getManagementVersion(client), "7.1.0");
});