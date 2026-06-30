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

test("buildDroidProxyModelDefinitions includes discovered management models", () => {
  const definitions = buildDroidProxyModelDefinitions(
    {
      proxyUrl: () => "http://127.0.0.1:8417",
      proxyBaseUrl: () => "http://127.0.0.1:8417/v1"
    },
    [
      { id: "cline-pass/deepseek-v4-flash", owned_by: "ClinePass" },
      { id: "gpt-5.4", owned_by: "codex" }
    ]
  );

  const cline = definitions.find((definition) => definition.baseModel === "cline-pass/deepseek-v4-flash");
  assert.ok(cline);
  assert.equal(cline!.idSlug, "management-cline-pass-deepseek-v4-flash");
  assert.equal(cline!.displayName, "ClinePass: DeepSeek V4 Flash");
  assert.equal(cline!.baseUrl, "http://127.0.0.1:8417/v1");
  assert.equal(cline!.provider, "generic-chat-completion-api");
  assert.equal(definitions.filter((definition) => definition.baseModel === "gpt-5.4").length, 1);

  const settingsModels = droidProxySettingsModels(definitions);
  assert.ok(settingsModels.some((model) => (
    model.id === "custom:droidproxy:management-cline-pass-deepseek-v4-flash" &&
    model.displayName === "DroidProxy: ClinePass: DeepSeek V4 Flash" &&
    model.provider === "generic-chat-completion-api"
  )));
});
