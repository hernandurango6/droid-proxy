import crypto from "node:crypto";
import { commandCodeReasoningEffort } from "./reasoning-effort";

type JsonRecord = Record<string, unknown>;

export function openAIToCommandCode(
  model: string,
  body: JsonRecord,
  stream: boolean,
  options: { cwd?: string; platform?: string } = {}
): JsonRecord {
  const messages = Array.isArray(body.messages) ? body.messages as JsonRecord[] : [];
  const { messages: convertedMessages, system } = commandCodeMessages(messages);
  const params: JsonRecord = {
    model,
    messages: convertedMessages,
    stream: stream !== false,
    max_tokens: body.max_tokens ?? body.max_output_tokens ?? 64000,
    temperature: body.temperature ?? 0.3
  };
  if (system) params.system = system;
  if (body.top_p != null) params.top_p = body.top_p;

  const reasoningEffort = commandCodeReasoningEffort(model, body);
  if (reasoningEffort) params.reasoning_effort = reasoningEffort;

  const tools = commandCodeTools(body.tools);
  if (tools) params.tools = tools;

  const today = new Date().toISOString().slice(0, 10);
  return {
    threadId: crypto.randomUUID(),
    memory: "",
    config: {
      workingDir: options.cwd ?? process.cwd(),
      date: today,
      environment: options.platform ?? process.platform,
      structure: [],
      isGitRepo: false,
      currentBranch: "",
      mainBranch: "",
      gitStatus: "",
      recentCommits: []
    },
    params
  };
}

export function commandCodeMessages(messages: JsonRecord[] = []): { messages: JsonRecord[]; system: string } {
  const converted: JsonRecord[] = [];
  const system: string[] = [];

  for (const message of messages || []) {
    if (!message) continue;
    if (message.role === "system") {
      const text = contentText(message.content);
      if (text) system.push(text);
      continue;
    }

    if (message.role === "tool") {
      const output = typeof message.content === "string" ? message.content : contentText(message.content);
      converted.push({
        role: "tool",
        content: [{
          type: "tool-result",
          toolCallId: message.tool_call_id || "",
          toolName: message.name || "",
          output: { type: "text", value: output }
        }]
      });
      continue;
    }

    if (message.role === "assistant") {
      const content: JsonRecord[] = [];
      const text = contentText(message.content);
      if (text) content.push({ type: "text", text });
      if (Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls as JsonRecord[]) {
          const fn = (toolCall.function || {}) as JsonRecord;
          content.push({
            type: "tool-call",
            toolCallId: toolCall.id || "",
            toolName: fn.name || "",
            input: parseToolArguments(fn.arguments)
          });
        }
      }
      converted.push({
        role: "assistant",
        content: content.length ? content : [{ type: "text", text: "" }]
      });
      continue;
    }

    converted.push({
      role: "user",
      content: commandCodeUserContent(message.content)
    });
  }

  return { messages: converted, system: system.join("\n\n") };
}

function commandCodeUserContent(content: unknown): JsonRecord[] {
  if (content == null) return [{ type: "text", text: "" }];
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: String(content) }];

  const blocks: JsonRecord[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      blocks.push({ type: "text", text: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as JsonRecord;
    if (record.type === "text" && typeof record.text === "string") {
      blocks.push({ type: "text", text: record.text });
    } else if (record.type === "image_url") {
      const imageUrl = record.image_url as { url?: string } | undefined;
      blocks.push({ type: "image", image: imageUrl?.url || "" });
    } else if (record.type === "image") {
      blocks.push({ type: "image", image: commandCodeImageValue(record) });
    } else if (typeof record.text === "string") {
      blocks.push({ type: "text", text: record.text });
    }
  }
  return blocks.length ? blocks : [{ type: "text", text: "" }];
}

function commandCodeImageValue(item: JsonRecord): string {
  if (typeof item.image === "string") return item.image;
  if (typeof item.url === "string") return item.url;
  const source = item.source as { data?: string; media_type?: string; mime_type?: string } | undefined;
  if (source?.data) {
    const mediaType = source.media_type || source.mime_type || "image/png";
    return `data:${mediaType};base64,${source.data}`;
  }
  if (typeof item.data === "string") {
    const mediaType = (item.media_type || item.mime_type || "image/png") as string;
    return item.data.startsWith("data:") ? item.data : `data:${mediaType};base64,${item.data}`;
  }
  return "";
}

function contentText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const item of content) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object" && typeof (item as JsonRecord).text === "string") {
        parts.push((item as JsonRecord).text as string);
      }
    }
    return parts.join("\n");
  }
  return String(content);
}

function parseToolArguments(value: unknown): unknown {
  if (value == null) return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function commandCodeTools(tools: unknown): JsonRecord[] | undefined {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const converted: JsonRecord[] = [];
  for (const tool of tools) {
    if (!tool || typeof tool !== "object") continue;
    const record = tool as JsonRecord;
    if (record.type === "function" && record.function) {
      const fn = record.function as JsonRecord;
      converted.push({
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters || { type: "object" }
      });
    } else if (record.name && (record.input_schema || record.parameters)) {
      converted.push({
        name: record.name,
        description: record.description,
        input_schema: record.input_schema || record.parameters
      });
    }
  }
  return converted.length ? converted : undefined;
}