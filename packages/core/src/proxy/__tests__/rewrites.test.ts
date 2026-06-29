import assert from "node:assert/strict";
import { test } from "node:test";
import {
  injectTopLevelJSONField,
  processOpenAIFastMode,
  rewriteClaudeThinkingBetas,
  rewriteGeminiResponsesPath
} from "../rewrites";

test("rewriteGeminiResponsesPath rewrites responses to chat completions for gemini preview models", () => {
  const body = { model: "gemini-2.5-pro-preview" };
  assert.equal(rewriteGeminiResponsesPath("/v1/responses?foo=1", body), "/v1/chat/completions?foo=1");
  assert.equal(rewriteGeminiResponsesPath("/api/v1/responses", body), "/v1/chat/completions");
  assert.equal(rewriteGeminiResponsesPath("/v1/chat/completions", body), "/v1/chat/completions");
  assert.equal(rewriteGeminiResponsesPath("/v1/responses", { model: "gpt-5.4" }), "/v1/responses");
});

test("rewriteClaudeThinkingBetas removes redacted beta and adds visible thinking betas", () => {
  const headers = {
    "anthropic-beta": "redact-thinking-2026-02-12,claude-code-20250219"
  };
  const parsedBody = {
    model: "claude-sonnet-4-6",
    thinking: { type: "enabled" }
  };

  const result = rewriteClaudeThinkingBetas(headers, parsedBody);
  const betas = String(result["anthropic-beta"]).split(",").map((v) => v.trim());

  assert.ok(!betas.some((beta) => beta.toLowerCase() === "redact-thinking-2026-02-12"));
  assert.ok(betas.includes("claude-code-20250219"));
  assert.ok(betas.includes("interleaved-thinking-2025-05-14"));
  assert.ok(betas.includes("context-1m-2025-08-07"));
});

test("rewriteClaudeThinkingBetas leaves headers unchanged for non-claude models", () => {
  const headers = { "anthropic-beta": "keep-me" };
  const result = rewriteClaudeThinkingBetas(headers, { model: "gpt-5.4", thinking: { type: "enabled" } });
  assert.deepEqual(result, headers);
});

test("injectTopLevelJSONField inserts field after opening brace", () => {
  assert.equal(
    injectTopLevelJSONField('{"model":"gpt-5.4"}', '"service_tier":"priority"'),
    '{"service_tier":"priority","model":"gpt-5.4"}'
  );
  assert.equal(
    injectTopLevelJSONField("{ }", '"service_tier":"priority"'),
    '{ "service_tier":"priority"}'
  );
});

test("processOpenAIFastMode injects priority tier for gpt-5.4 when env flag is set", () => {
  const previous = process.env.DROIDPROXY_GPT54_FAST_MODE;
  process.env.DROIDPROXY_GPT54_FAST_MODE = "1";

  try {
    const body = Buffer.from('{"model":"gpt-5.4","input":"hi"}', "utf8");
    const parsedBody = { model: "gpt-5.4", input: "hi" };
    const result = processOpenAIFastMode("/v1/responses", body, parsedBody);

    assert.equal(result.changed, true);
    assert.match(result.body || "", /"service_tier":"priority"/);
    assert.equal(result.parsedBody?.service_tier, "priority");
  } finally {
    if (previous === undefined) delete process.env.DROIDPROXY_GPT54_FAST_MODE;
    else process.env.DROIDPROXY_GPT54_FAST_MODE = previous;
  }
});

test("processOpenAIFastMode is a no-op when service_tier already present", () => {
  const body = Buffer.from('{"model":"gpt-5.4","service_tier":"default"}', "utf8");
  const parsedBody = { model: "gpt-5.4", service_tier: "default" };
  const result = processOpenAIFastMode("/v1/responses", body, parsedBody);
  assert.equal(result.changed, false);
});