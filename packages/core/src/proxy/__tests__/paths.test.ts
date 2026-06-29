import assert from "node:assert/strict";
import { test } from "node:test";
import { isChatCompletionsPath, isModelsPath, isResponsesAPIPath } from "../paths";

test("path helpers recognize OpenAI-compatible routes", () => {
  assert.equal(isModelsPath("/v1/models"), true);
  assert.equal(isModelsPath("/api/v1/models?x=1"), true);
  assert.equal(isModelsPath("/v1/chat/completions"), false);

  assert.equal(isChatCompletionsPath("/v1/chat/completions"), true);
  assert.equal(isChatCompletionsPath("/api/v1/chat/completions"), true);
  assert.equal(isChatCompletionsPath("/v1/models"), false);

  assert.equal(isResponsesAPIPath("/v1/responses"), true);
  assert.equal(isResponsesAPIPath("/api/v1/responses"), true);
  assert.equal(isResponsesAPIPath("/v1/chat/completions"), false);
});