import type { ServerResponse } from "node:http";

export interface CommandCodeStreamState {
  model?: string;
  responseId?: string;
  created?: number;
  chunkIndex?: number;
  toolIndex?: number;
  toolIndexById?: Map<string, number>;
  finishReason?: string | null;
  usage?: Record<string, unknown> | null;
}

export function convertCommandCodeToOpenAI(
  event: unknown,
  state: CommandCodeStreamState
): Array<Record<string, unknown>> | null {
  if (!event) return null;
  if (event && typeof event === "object" && (event as Record<string, unknown>).object === "chat.completion.chunk") {
    return [event as Record<string, unknown>];
  }

  let data: Record<string, unknown>;
  if (typeof event === "string") {
    const trimmed = event.trim();
    if (!trimmed) return null;
    const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    if (!payload || payload === "[DONE]") return null;
    try {
      data = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (event && typeof event === "object") {
    data = event as Record<string, unknown>;
  } else {
    return null;
  }

  if (!data.type) return null;

  initCommandCodeStreamState(state, data.model as string | undefined);
  const chunks: Array<Record<string, unknown>> = [];
  const push = (delta: Record<string, unknown>, finishReason: string | null = null) => {
    chunks.push(openAIChunk(state, delta, finishReason));
  };

  switch (data.type) {
    case "text-delta": {
      const text = (data.text || data.delta || "") as string;
      if (text) {
        push(state.chunkIndex === 0 ? { role: "assistant", content: text } : { content: text });
        state.chunkIndex = (state.chunkIndex ?? 0) + 1;
      }
      break;
    }
    case "reasoning-delta": {
      const text = (data.text || "") as string;
      if (text) {
        push(state.chunkIndex === 0
          ? { role: "assistant", reasoning_content: text }
          : { reasoning_content: text });
        state.chunkIndex = (state.chunkIndex ?? 0) + 1;
      }
      break;
    }
    case "tool-input-start": {
      const id = (data.id || data.toolCallId || `call_${Date.now()}_${state.toolIndex}`) as string;
      let index = state.toolIndexById?.get(id);
      if (index == null) {
        index = state.toolIndex ?? 0;
        state.toolIndex = index + 1;
        state.toolIndexById?.set(id, index);
      }
      push({
        ...(state.chunkIndex === 0 ? { role: "assistant" } : {}),
        tool_calls: [{
          index,
          id,
          type: "function",
          function: { name: (data.toolName || "") as string, arguments: "" }
        }]
      });
      state.chunkIndex = (state.chunkIndex ?? 0) + 1;
      break;
    }
    case "tool-input-delta": {
      const index = state.toolIndexById?.get((data.id || data.toolCallId) as string);
      if (index != null) {
        push({
          tool_calls: [{
            index,
            function: { arguments: (data.delta || data.inputTextDelta || "") as string }
          }]
        });
      }
      break;
    }
    case "tool-call": {
      const id = (data.toolCallId || data.id || `call_${Date.now()}_${state.toolIndex}`) as string;
      if (!state.toolIndexById?.has(id)) {
        const index = state.toolIndex ?? 0;
        state.toolIndex = index + 1;
        state.toolIndexById?.set(id, index);
        const args = typeof data.input === "string" ? data.input : JSON.stringify(data.input ?? {});
        push({
          ...(state.chunkIndex === 0 ? { role: "assistant" } : {}),
          tool_calls: [{
            index,
            id,
            type: "function",
            function: { name: (data.toolName || "") as string, arguments: args }
          }]
        });
        state.chunkIndex = (state.chunkIndex ?? 0) + 1;
      }
      break;
    }
    case "finish-step":
      state.finishReason = commandCodeFinishReason(data.finishReason);
      if (data.usage) state.usage = data.usage as Record<string, unknown>;
      break;
    case "finish": {
      const finishReason = state.finishReason || commandCodeFinishReason((data.finishReason || "stop") as string);
      const chunk = openAIChunk(state, {}, finishReason);
      const usage = (data.totalUsage || state.usage) as Record<string, unknown> | undefined;
      if (usage) chunk.usage = commandCodeUsage(usage);
      chunks.push(chunk);
      break;
    }
    case "error": {
      const error = data.error ?? data.message ?? "unknown";
      const text = typeof error === "string" ? error : JSON.stringify(error);
      push({ content: `\n\n[CommandCode error: ${text}]` });
      push({}, "stop");
      break;
    }
  }

  return chunks.length ? chunks : null;
}

function initCommandCodeStreamState(state: CommandCodeStreamState, model?: string): void {
  if (state.responseId) return;
  state.responseId = `chatcmpl-${Date.now()}`;
  state.created = Math.floor(Date.now() / 1000);
  state.model = state.model || model || "commandcode";
  state.chunkIndex = 0;
  state.toolIndex = 0;
  state.toolIndexById = new Map();
  state.finishReason = null;
  state.usage = null;
}

function openAIChunk(
  state: CommandCodeStreamState,
  delta: Record<string, unknown>,
  finishReason: string | null = null
): Record<string, unknown> {
  return {
    id: state.responseId,
    object: "chat.completion.chunk",
    created: state.created,
    model: state.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  };
}

function commandCodeFinishReason(reason: unknown): string {
  switch (reason) {
    case "stop":
    case "error":
      return "stop";
    case "length":
      return "length";
    case "tool-calls":
    case "tool_use":
      return "tool_calls";
    case "content-filter":
      return "content_filter";
    default:
      return (reason as string) || "stop";
  }
}

function commandCodeUsage(usage: Record<string, unknown>): Record<string, number> {
  const prompt = (usage.inputTokens ?? 0) as number;
  const completion = (usage.outputTokens ?? 0) as number;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: (usage.totalTokens ?? prompt + completion) as number
  };
}

export function writeOpenAIChunks(clientRes: ServerResponse, chunks: unknown): void {
  if (!chunks) return;
  for (const chunk of Array.isArray(chunks) ? chunks : [chunks]) {
    if (chunk) clientRes.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
}

export async function streamCommandCodeAsOpenAI(
  response: Response,
  model: string,
  clientRes: ServerResponse
): Promise<void> {
  clientRes.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*"
  });

  const decoder = new TextDecoder();
  const state: CommandCodeStreamState = { model };
  let buffer = "";

  if (!response.body) {
    clientRes.end("data: [DONE]\n\n");
    return;
  }

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      writeOpenAIChunks(clientRes, convertCommandCodeToOpenAI(line, state));
    }
  }

  const rest = buffer.trim();
  if (rest) writeOpenAIChunks(clientRes, convertCommandCodeToOpenAI(rest, state));
  clientRes.end("data: [DONE]\n\n");
}

export async function collectCommandCodeCompletion(
  response: Response,
  model: string
): Promise<Record<string, unknown>> {
  const decoder = new TextDecoder();
  const state: CommandCodeStreamState = { model };
  let buffer = "";
  let content = "";
  let reasoning = "";
  let finishReason = "stop";
  let usage: Record<string, unknown> | null = null;

  const consume = (line: string) => {
    const chunks = convertCommandCodeToOpenAI(line, state) || [];
    for (const chunk of chunks) {
      const choices = chunk.choices as Array<Record<string, unknown>> | undefined;
      const choice = choices?.[0];
      const delta = (choice?.delta || {}) as Record<string, unknown>;
      if (delta.content) content += String(delta.content);
      if (delta.reasoning_content) reasoning += String(delta.reasoning_content);
      if (choice?.finish_reason) finishReason = String(choice.finish_reason);
      if (chunk.usage) usage = chunk.usage as Record<string, unknown>;
    }
  };

  if (!response.body) {
    return buildCompletionResult(state, model, content, reasoning, finishReason, usage);
  }

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consume(line);
  }
  if (buffer.trim()) consume(buffer.trim());

  return buildCompletionResult(state, model, content, reasoning, finishReason, usage);
}

function buildCompletionResult(
  state: CommandCodeStreamState,
  model: string,
  content: string,
  reasoning: string,
  finishReason: string,
  usage: Record<string, unknown> | null
): Record<string, unknown> {
  const message: Record<string, unknown> = { role: "assistant", content };
  if (reasoning) message.reasoning_content = reasoning;
  const result: Record<string, unknown> = {
    id: state.responseId || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: state.created || Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }]
  };
  if (usage) result.usage = usage;
  return result;
}