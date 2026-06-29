import assert from "node:assert/strict";
import { test } from "node:test";
import {
  commandCodeOpenAIModels,
  commandCodeSlug,
  commandCodeUpstreamModel,
  isCommandCodeModel
} from "../models";

test("isCommandCodeModel recognizes commandcode and cmc prefixes", () => {
  assert.equal(isCommandCodeModel("commandcode:deepseek/deepseek-v4-pro"), true);
  assert.equal(isCommandCodeModel("cmc:gpt-5.4"), true);
  assert.equal(isCommandCodeModel("gpt-5.4"), false);
});

test("commandCodeUpstreamModel strips routing prefixes", () => {
  assert.equal(commandCodeUpstreamModel("commandcode:Qwen/Qwen3.7-Max"), "Qwen/Qwen3.7-Max");
  assert.equal(commandCodeUpstreamModel("cmc:claude-opus-4-8"), "claude-opus-4-8");
  assert.equal(commandCodeUpstreamModel("gpt-5.4"), "gpt-5.4");
});

test("commandCodeSlug normalizes model ids", () => {
  assert.equal(commandCodeSlug("Qwen/Qwen3.7-Max"), "qwen-qwen3-7-max");
  assert.equal(commandCodeSlug("claude-opus-4-8"), "claude-opus-4-8");
});

test("commandCodeOpenAIModels exposes prefixed model list entries", () => {
  const models = commandCodeOpenAIModels();
  assert.ok(models.length > 0);
  assert.equal(models[0].object, "model");
  assert.match(String(models[0].id), /^commandcode:/);
  assert.equal(models[0].owned_by, "commandcode");
});