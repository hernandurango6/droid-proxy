import assert from "node:assert/strict";
import { test } from "node:test";
import { getFactoryModelSelection, saveFactoryModelSelection } from "../selection";
import type { DroidProxyFactoryModel } from "../types";

const enabledModels: DroidProxyFactoryModel[] = [
  {
    model: "gpt-5.4",
    id: "custom:droidproxy:gpt-5.4",
    baseUrl: "http://127.0.0.1:8417/v1",
    apiKey: "dummy-not-used",
    displayName: "DroidProxy: GPT 5.4",
    maxOutputTokens: 128000,
    provider: "openai"
  },
  {
    model: "gpt-5.5",
    id: "custom:droidproxy:gpt-5.5",
    baseUrl: "http://127.0.0.1:8417/v1",
    apiKey: "dummy-not-used",
    displayName: "DroidProxy: GPT 5.5",
    maxOutputTokens: 128000,
    provider: "openai"
  }
];

test("getFactoryModelSelection defaults to all models when unset", () => {
  let saved = false;
  const settings = {
    managementSecretKey: "x".repeat(32),
    commandCodeApiKeys: []
  };

  const selected = getFactoryModelSelection(settings, enabledModels, () => { saved = true; });
  assert.deepEqual(selected, enabledModels.map((model) => model.id));
  assert.equal(saved, true);
});

test("saveFactoryModelSelection filters unknown ids", () => {
  let saved = false;
  const settings = {
    managementSecretKey: "x".repeat(32),
    commandCodeApiKeys: [],
    factoryModelIds: enabledModels.map((model) => model.id)
  };

  saveFactoryModelSelection(
    settings,
    ["custom:droidproxy:gpt-5.4", "custom:droidproxy:missing"],
    enabledModels,
    () => { saved = true; }
  );

  assert.deepEqual(settings.factoryModelIds, ["custom:droidproxy:gpt-5.4"]);
  assert.equal(saved, true);
});