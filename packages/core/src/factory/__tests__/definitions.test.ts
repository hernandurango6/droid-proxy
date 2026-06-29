import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDroidProxyModelDefinitions } from "../definitions";
import { droidProxySettingsModels } from "../settings-models";

test("buildDroidProxyModelDefinitions uses injected proxy URLs", () => {
  const definitions = buildDroidProxyModelDefinitions({
    proxyUrl: () => "http://192.168.1.50:9999",
    proxyBaseUrl: () => "http://192.168.1.50:9999/v1"
  });

  const codex = definitions.find((definition) => definition.baseModel === "gpt-5.4");
  assert.ok(codex);
  assert.equal(codex!.baseUrl, "http://192.168.1.50:9999/v1");

  const claude = definitions.find((definition) => definition.baseModel === "claude-sonnet-4-6");
  assert.ok(claude);
  assert.equal(claude!.baseUrl, "http://192.168.1.50:9999");

  const settingsModels = droidProxySettingsModels(definitions);
  const codexFactory = settingsModels.find((model) => model.model === "gpt-5.4");
  assert.equal(codexFactory?.baseUrl, "http://192.168.1.50:9999/v1");
});

test("buildDroidProxyModelDefinitions includes CommandCode catalog entries", () => {
  const definitions = buildDroidProxyModelDefinitions({
    proxyUrl: () => "http://127.0.0.1:8417",
    proxyBaseUrl: () => "http://127.0.0.1:8417/v1"
  });

  const commandCodeEntry = definitions.find((definition) => definition.kind === "commandcode");
  assert.ok(commandCodeEntry);
  assert.match(commandCodeEntry!.baseModel, /^commandcode:/);
});