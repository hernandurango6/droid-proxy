import assert from "node:assert/strict";
import { test } from "node:test";
import { ManagementClient } from "../client";
import { normalizeManagementBaseUrl } from "../normalize";

test("normalizeManagementBaseUrl accepts management page and API URLs", () => {
  assert.equal(
    normalizeManagementBaseUrl("http://127.0.0.1:8418/management.html"),
    "http://127.0.0.1:8418/v0/management"
  );
  assert.equal(
    normalizeManagementBaseUrl("http://127.0.0.1:8418/v0/management/"),
    "http://127.0.0.1:8418/v0/management"
  );
});

test("ManagementClient attaches Bearer auth and normalizes paths", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = new ManagementClient({
    baseUrl: "http://127.0.0.1:8418/v0/management",
    secretKey: "secret-key",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });

  const response = await client.request("version");
  assert.equal(response.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://127.0.0.1:8418/v0/management/version");
  assert.match(String(calls[0].init.headers && (calls[0].init.headers as Record<string, string>).Authorization), /Bearer secret-key/);
});