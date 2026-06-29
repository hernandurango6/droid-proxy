import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { applyFactoryCustomModels } from "../apply";
import { backupFactorySettingsIfPresent } from "../factory-settings";
import { buildDroidProxyModelDefinitions } from "../definitions";

test("backupFactorySettingsIfPresent uses droidproxy timestamped filename", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-factory-"));
  const settingsPath = path.join(dir, "settings.json");
  fs.writeFileSync(settingsPath, '{"customModels":[]}\n');

  const backupPath = backupFactorySettingsIfPresent(settingsPath);
  assert.ok(backupPath);
  assert.match(path.basename(backupPath!), /^settings\.json\.droidproxy-\d{8}-\d{6}\.bak$/);
  assert.ok(fs.existsSync(backupPath!));
});

test("applyFactoryCustomModels writes selected models and retains non-droidproxy entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "droidproxy-factory-"));
  const settingsPath = path.join(dir, "settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify({
    customModels: [{ id: "custom:other:model", model: "other", baseUrl: "http://example" }]
  }, null, 2));

  const definitions = buildDroidProxyModelDefinitions({
    proxyUrl: () => "http://127.0.0.1:8417",
    proxyBaseUrl: () => "http://127.0.0.1:8417/v1"
  });
  const appSettings = {
    managementSecretKey: "x".repeat(32),
    commandCodeApiKeys: []
  };

  const result = applyFactoryCustomModels({
    definitions,
    settings: appSettings,
    factorySettingsPath: settingsPath,
    saveSettings: () => {}
  });

  assert.equal(result.applied, true);
  assert.ok(result.count > 0);

  const written = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
    customModels: Array<{ id: string }>;
  };
  assert.ok(written.customModels.some((model) => model.id === "custom:other:model"));
  assert.ok(written.customModels.some((model) => model.id.startsWith("custom:droidproxy:")));
});