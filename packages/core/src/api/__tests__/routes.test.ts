import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { CommandCodeApiKeyRotator } from "../../commandcode/api-keys";
import { handleDashboardAPI } from "../routes";

function createMockResponse(): { res: ServerResponse; statusCode: number; body: string } {
  let statusCode = 0;
  let body = "";
  const res = {
    writeHead(code: number) {
      statusCode = code;
    },
    end(data?: string) {
      if (data) body += data;
    }
  } as unknown as ServerResponse;
  return {
    res,
    get statusCode() { return statusCode; },
    get body() { return body; }
  };
}

function createRequest(method: string, url: string, payload?: unknown): IncomingMessage {
  const req = new Readable({ read() {} }) as IncomingMessage;
  req.method = method;
  req.url = url;
  if (payload !== undefined) {
    req.push(JSON.stringify(payload));
  }
  req.push(null);
  return req;
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    authDir: "C:\\auth",
    configPath: "C:\\auth\\config.yaml",
    commandCodeAuthPath: "C:\\auth\\commandcode.json",
    commandCodeApiUrl: "https://api.commandcode.ai/alpha/generate",
    factorySettingsPath: "C:\\factory\\settings.json",
    managementUrl: "http://127.0.0.1:8418/management.html",
    settings: {
      managementSecretKey: "x".repeat(32),
      commandCodeApiKeys: []
    },
    env: {},
    appLogs: ["[12:00:00] started"],
    commandCodeApiKeyRotator: new CommandCodeApiKeyRotator(),
    getSavedCommandCodeApiKeys: () => [],
    saveSettings: () => {},
    statusPayload: () => ({ backend: { running: true } }),
    getAccounts: () => [{ file: "a.json", type: "claude", email: "a@example.com", disabled: false }],
    factoryModelsStatus: () => ({
      installed: false,
      expectedCount: 1,
      selectedCount: 1,
      installedCount: 0,
      settingsPath: "C:\\factory\\settings.json",
      selectedIds: ["custom:droidproxy:gpt-5.4"],
      models: []
    }),
    saveFactoryModelSelection: () => {},
    applyFactoryCustomModels: () => ({
      applied: true,
      count: 1,
      settingsPath: "C:\\factory\\settings.json",
      backupPath: null
    }),
    fetchModels: async () => [{ id: "gpt-5.4" }],
    runLoginDetached: () => {},
    openPath: () => {},
    writeConfig: () => {},
    ...overrides
  };
}

test("handleDashboardAPI serves status payload", async () => {
  const mock = createMockResponse();
  await handleDashboardAPI(
    createRequest("GET", "/api/status"),
    mock.res,
    new URL("http://127.0.0.1:8419/api/status"),
    baseContext() as never
  );

  assert.equal(mock.statusCode, 200);
  assert.deepEqual(JSON.parse(mock.body).backend, { running: true });
});

test("handleDashboardAPI serves accounts from context", async () => {
  const mock = createMockResponse();
  await handleDashboardAPI(
    createRequest("GET", "/api/accounts"),
    mock.res,
    new URL("http://127.0.0.1:8419/api/accounts"),
    baseContext() as never
  );

  const payload = JSON.parse(mock.body) as { accounts: Array<{ email: string }> };
  assert.equal(payload.accounts[0].email, "a@example.com");
});

test("handleDashboardAPI rejects invalid login provider", async () => {
  const mock = createMockResponse();
  await handleDashboardAPI(
    createRequest("POST", "/api/login", { provider: "invalid" }),
    mock.res,
    new URL("http://127.0.0.1:8419/api/login"),
    baseContext() as never
  );

  assert.equal(mock.statusCode, 400);
  assert.equal(JSON.parse(mock.body).error, "invalid_provider");
});

test("handleDashboardAPI returns 404 for unknown routes", async () => {
  const mock = createMockResponse();
  await handleDashboardAPI(
    createRequest("GET", "/api/unknown"),
    mock.res,
    new URL("http://127.0.0.1:8419/api/unknown"),
    baseContext() as never
  );

  assert.equal(mock.statusCode, 404);
});