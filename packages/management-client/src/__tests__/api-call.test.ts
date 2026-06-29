import assert from "node:assert/strict";
import { test } from "node:test";
import { apiCall, getApiCallErrorMessage } from "../api-call";
import { ManagementClient } from "../client";

test("apiCall posts provider request payload to management API", async () => {
  let postedBody: Record<string, unknown> | null = null;
  const client = new ManagementClient({
    baseUrl: "http://127.0.0.1:8418/v0/management",
    secretKey: "secret-key",
    fetchImpl: async (_url, init) => {
      postedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({
        status_code: 200,
        body: JSON.stringify({ plan_type: "plus" })
      }), { status: 200 });
    }
  });

  const result = await apiCall(client, {
    authIndex: "0",
    method: "GET",
    url: "https://chatgpt.com/backend-api/wham/usage",
    header: { Accept: "application/json" }
  });

  assert.equal(result.statusCode, 200);
  assert.equal(postedBody?.auth_index, "0");
  assert.equal(postedBody?.method, "GET");
});

test("getApiCallErrorMessage prefers structured error fields", () => {
  assert.equal(
    getApiCallErrorMessage({ statusCode: 403, error: "forbidden" }),
    "forbidden"
  );
  assert.match(
    getApiCallErrorMessage({ statusCode: 500, body: { message: "upstream failed" } }),
    /upstream failed/
  );
});