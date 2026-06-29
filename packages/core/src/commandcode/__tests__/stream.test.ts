import assert from "node:assert/strict";
import { test } from "node:test";
import { convertCommandCodeToOpenAI } from "../stream";

test("convertCommandCodeToOpenAI maps text-delta events to OpenAI chunks", () => {
  const state = { model: "deepseek/deepseek-v4-pro" };
  const chunks = convertCommandCodeToOpenAI(
    'data: {"type":"text-delta","text":"Hello"}',
    state
  );

  assert.ok(chunks);
  assert.equal(chunks!.length, 1);
  const choice = (chunks![0].choices as Array<Record<string, unknown>>)[0];
  const delta = choice.delta as Record<string, unknown>;
  assert.equal(delta.role, "assistant");
  assert.equal(delta.content, "Hello");
});

test("convertCommandCodeToOpenAI maps reasoning-delta and finish events", () => {
  const state = { model: "Qwen/Qwen3.7-Max" };

  const reasoningChunks = convertCommandCodeToOpenAI(
    { type: "reasoning-delta", text: "thinking" },
    state
  );
  assert.ok(reasoningChunks);
  const reasoningDelta = ((reasoningChunks![0].choices as Array<Record<string, unknown>>)[0].delta
    || {}) as Record<string, unknown>;
  assert.equal(reasoningDelta.reasoning_content, "thinking");

  convertCommandCodeToOpenAI({ type: "finish-step", finishReason: "tool-calls" }, state);
  const finishChunks = convertCommandCodeToOpenAI({
    type: "finish",
    finishReason: "tool-calls",
    totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
  }, state);

  assert.ok(finishChunks);
  const finishChoice = (finishChunks![0].choices as Array<Record<string, unknown>>)[0];
  assert.equal(finishChoice.finish_reason, "tool_calls");
  assert.deepEqual(finishChunks![0].usage, {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15
  });
});

test("convertCommandCodeToOpenAI maps tool-call events", () => {
  const state = { model: "gpt-5.4" };
  const chunks = convertCommandCodeToOpenAI({
    type: "tool-call",
    toolCallId: "call_99",
    toolName: "grep",
    input: { pattern: "foo" }
  }, state);

  assert.ok(chunks);
  const delta = ((chunks![0].choices as Array<Record<string, unknown>>)[0].delta
    || {}) as Record<string, unknown>;
  const toolCalls = delta.tool_calls as Array<Record<string, unknown>>;
  assert.equal(toolCalls[0].id, "call_99");
  assert.equal((toolCalls[0].function as Record<string, unknown>).name, "grep");
  assert.match(String((toolCalls[0].function as Record<string, unknown>).arguments), /foo/);
});