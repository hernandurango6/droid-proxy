import assert from "node:assert/strict";
import { test } from "node:test";
import { commandCodeMessages, openAIToCommandCode } from "../convert";

test("openAIToCommandCode maps chat messages and params", () => {
  const body = {
    model: "commandcode:deepseek/deepseek-v4-pro",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" }
    ],
    max_tokens: 1200,
    temperature: 0.7,
    reasoning_effort: "high",
    tools: [{
      type: "function",
      function: {
        name: "read_file",
        description: "Read a file",
        parameters: { type: "object", properties: { path: { type: "string" } } }
      }
    }]
  };

  const result = openAIToCommandCode("deepseek/deepseek-v4-pro", body, true, {
    cwd: "/tmp/project",
    platform: "win32"
  });

  assert.equal(typeof result.threadId, "string");
  assert.equal((result.config as Record<string, unknown>).workingDir, "/tmp/project");
  assert.equal((result.config as Record<string, unknown>).environment, "win32");
  const params = result.params as Record<string, unknown>;
  assert.equal(params.model, "deepseek/deepseek-v4-pro");
  assert.equal(params.stream, true);
  assert.equal(params.max_tokens, 1200);
  assert.equal(params.temperature, 0.7);
  assert.equal(params.reasoning_effort, "high");
  assert.equal(params.system, "You are helpful.");
  assert.ok(Array.isArray(params.tools));
});

test("commandCodeMessages converts assistant tool calls and tool results", () => {
  const { messages, system } = commandCodeMessages([
    { role: "system", content: "sys" },
    {
      role: "assistant",
      content: "",
      tool_calls: [{
        id: "call_1",
        type: "function",
        function: { name: "bash", arguments: "{\"cmd\":\"ls\"}" }
      }]
    },
    { role: "tool", tool_call_id: "call_1", name: "bash", content: "ok" }
  ]);

  assert.equal(system, "sys");
  assert.equal(messages[0].role, "assistant");
  const assistantContent = messages[0].content as Array<Record<string, unknown>>;
  assert.equal(assistantContent[0].type, "tool-call");
  assert.equal(assistantContent[0].toolName, "bash");
  assert.deepEqual(assistantContent[0].input, { cmd: "ls" });

  assert.equal(messages[1].role, "tool");
  const toolContent = messages[1].content as Array<Record<string, unknown>>;
  assert.equal(toolContent[0].type, "tool-result");
  assert.equal((toolContent[0].output as Record<string, unknown>).value, "ok");
});