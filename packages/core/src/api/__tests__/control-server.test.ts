import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { test } from "node:test";
import { CommandCodeApiKeyRotator } from "../../commandcode/api-keys";
import { CONTROL_BIND_HOST, handleControlRequest } from "../control-server";

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

function createRequest(method: string, url: string): IncomingMessage {
  const req = new Readable({ read() {} }) as IncomingMessage;
  req.method = method;
  req.url = url;
  req.push(null);
  return req;
}

function baseContext() {
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
    appLogs: [],
    commandCodeApiKeyRotator: new CommandCodeApiKeyRotator(),
    getSavedCommandCodeApiKeys: () => [],
    saveSettings: () => {},
    statusPayload: () => ({ backend: { running: true } }),
    getAccounts: () => [],
    factoryModelsStatus: () => ({
      installed: false,
      expectedCount: 0,
      selectedCount: 0,
      installedCount: 0,
      settingsPath: "C:\\factory\\settings.json",
      selectedIds: [],
      models: []
    }),
    saveFactoryModelSelection: () => {},
    applyFactoryCustomModels: () => ({
      applied: false,
      count: 0,
      settingsPath: "C:\\factory\\settings.json",
      backupPath: null
    }),
    fetchModels: async () => [],
    runLoginDetached: () => {},
    openPath: () => {},
    writeConfig: () => {},
    fetchQuotaUsage: async () => ({
      fetchedAt: "2026-06-29T12:00:00.000Z",
      thresholds: { warn: 80, critical: 95 },
      accounts: [],
      alerts: []
    }),
    resetCodexQuota: async () => ({
      fetchedAt: "2026-06-29T12:00:00.000Z",
      thresholds: { warn: 80, critical: 95 },
      accounts: [],
      alerts: []
    })
  };
}

test("handleControlRequest serves health payload on loopback control host", async () => {
  const mock = createMockResponse();
  const health = {
    status: "ok" as const,
    control: { running: true, url: `http://${CONTROL_BIND_HOST}:8420` },
    proxy: { running: true, url: "http://127.0.0.1:8417" },
    backend: { running: true, pid: 42, url: "http://127.0.0.1:8418" }
  };

  await handleControlRequest(
    createRequest("GET", "/health"),
    mock.res,
    new URL("http://127.0.0.1:8420/health"),
    {
      apiContext: baseContext(),
      getHealthPayload: () => health
    }
  );

  assert.equal(mock.statusCode, 200);
  assert.deepEqual(JSON.parse(mock.body), health);
});

test("handleControlRequest forwards /api routes to dashboard handlers", async () => {
  const mock = createMockResponse();

  await handleControlRequest(
    createRequest("GET", "/api/logs"),
    mock.res,
    new URL("http://127.0.0.1:8420/api/logs"),
    {
      apiContext: { ...baseContext(), appLogs: ["line-1"] },
      getHealthPayload: () => ({
        status: "ok",
        control: { running: true, url: "http://127.0.0.1:8420" },
        proxy: { running: true, url: "http://127.0.0.1:8417" },
        backend: { running: true, pid: 1, url: "http://127.0.0.1:8418" }
      })
    }
  );

  assert.equal(mock.statusCode, 200);
  assert.deepEqual(JSON.parse(mock.body), { logs: ["line-1"] });
});

test("handleControlRequest returns 404 for unknown routes", async () => {
  const mock = createMockResponse();

  await handleControlRequest(
    createRequest("GET", "/index.html"),
    mock.res,
    new URL("http://127.0.0.1:8420/index.html"),
    {
      apiContext: baseContext(),
      getHealthPayload: () => ({
        status: "degraded",
        control: { running: false, url: "http://127.0.0.1:8420" },
        proxy: { running: false, url: "http://127.0.0.1:8417" },
        backend: { running: false, pid: null, url: "http://127.0.0.1:8418" }
      })
    }
  );

  assert.equal(mock.statusCode, 404);
  assert.deepEqual(JSON.parse(mock.body), { error: "not_found" });
});