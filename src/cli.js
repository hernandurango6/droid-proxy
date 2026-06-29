const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFile } = require("child_process");
const {
  loadSettings,
  saveSettings: persistSettings,
  writeConfig: writeConfigFile,
  parseCommandCodeApiKeys,
  maskApiKey,
  envFlag
} = require("@droidproxy/core");

const ROOT_DIR = path.resolve(__dirname, "..");
const AUTH_DIR = path.join(os.homedir(), ".cli-proxy-api");
const CONFIG_PATH = path.join(AUTH_DIR, "droidproxy-commandcode-lab-config.yaml");
const SETTINGS_PATH = path.join(AUTH_DIR, "droidproxy-commandcode-lab-settings.json");
const DEBUG_LOG_PATH = path.join(os.tmpdir(), "droidproxy-debug.log");
const FACTORY_SETTINGS_PATH = path.join(os.homedir(), ".factory", "settings.json");

const FRONTEND_HOST = process.env.DROIDPROXY_HOST || "0.0.0.0";
const FRONTEND_PORT = parsePort(process.env.DROIDPROXY_PORT, 8417);
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = parsePort(process.env.DROIDPROXY_BACKEND_PORT, 8418);
const DASHBOARD_HOST = process.env.DROIDPROXY_DASHBOARD_HOST || "0.0.0.0";
const DASHBOARD_PORT = parsePort(process.env.DROIDPROXY_DASHBOARD_PORT, 8419);
const PUBLIC_HOST = process.env.DROIDPROXY_PUBLIC_HOST || detectPublicHost();
const DASHBOARD_DIR = path.join(ROOT_DIR, "dashboard");
const MANAGEMENT_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}/management.html`;
const COMMANDCODE_API_URL = process.env.DROIDPROXY_COMMANDCODE_URL || "https://api.commandcode.ai/alpha/generate";
const COMMANDCODE_AUTH_PATH = path.join(os.homedir(), ".commandcode", "auth.json");
const COMMANDCODE_MODELS = [
  { id: "deepseek/deepseek-v4-pro", name: "DeepSeek V4 Pro", levels: ["high", "max"], defaultLevel: "max" },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash", levels: ["high", "max"], defaultLevel: "max" },
  { id: "moonshotai/Kimi-K2.7-Code", name: "Kimi K2.7 Code", vision: true, reasoning: true },
  { id: "moonshotai/Kimi-K2.7-Code-Highspeed", name: "Kimi K2.7 Code Highspeed", vision: true, reasoning: true },
  { id: "moonshotai/Kimi-K2.6", name: "Kimi K2.6", vision: true },
  { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", vision: true },
  { id: "zai-org/GLM-5.2", name: "GLM 5.2" },
  { id: "zai-org/GLM-5.1", name: "GLM 5.1" },
  { id: "zai-org/GLM-5", name: "GLM 5" },
  { id: "MiniMaxAI/MiniMax-M3", name: "MiniMax M3", vision: true, reasoning: true },
  { id: "MiniMaxAI/MiniMax-M2.7", name: "MiniMax M2.7" },
  { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
  { id: "xiaomi/mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
  { id: "xiaomi/mimo-v2.5", name: "MiMo V2.5", vision: true },
  { id: "Qwen/Qwen3.6-Max-Preview", name: "Qwen 3.6 Max Preview", reasoning: true },
  { id: "Qwen/Qwen3.6-Plus", name: "Qwen 3.6 Plus", vision: true, reasoning: true },
  { id: "Qwen/Qwen3.7-Max", name: "Qwen 3.7 Max", reasoning: true },
  { id: "Qwen/Qwen3.7-Plus", name: "Qwen 3.7 Plus", vision: true, reasoning: true },
  { id: "stepfun/Step-3.7-Flash", name: "Step 3.7 Flash", vision: true, reasoning: true },
  { id: "stepfun/Step-3.5-Flash", name: "Step 3.5 Flash", reasoning: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B A55B", reasoning: true },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
  { id: "claude-fable-5", name: "Claude Fable 5" },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8" },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7" },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  { id: "gpt-5.5", name: "GPT 5.5" },
  { id: "gpt-5.4", name: "GPT 5.4" },
  { id: "gpt-5.3-codex", name: "GPT 5.3 Codex" },
  { id: "gpt-5.4-mini", name: "GPT 5.4 Mini" },
  { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash" },
  { id: "google/gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
  { id: "sakana/fugu-ultra", name: "Fugu Ultra" }
];

const CLAUDE_REDACTED_THINKING_BETA = "redact-thinking-2026-02-12";
const CLAUDE_VISIBLE_THINKING_BETAS = [
  "claude-code-20250219",
  "interleaved-thinking-2025-05-14",
  "prompt-caching-2024-07-31",
  "context-1m-2025-08-07",
  "output-128k-2025-02-19"
];

const LOGIN_FLAGS = {
  claude: "-claude-login",
  codex: "-codex-login",
  "codex-device": "-codex-device-login",
  kimi: "-kimi-login",
  antigravity: "-antigravity-login",
  gemini: "-login",
  xai: "-xai-login"
};

const DROIDPROXY_MODEL_PREFIXES = ["custom:droidproxy:", "custom:CC:"];
const DROIDPROXY_MODEL_DEFINITIONS = buildDroidProxyModelDefinitions();

let backendProcess = null;
let frontendServer = null;
let dashboardServer = null;
let appLogs = [];
let settings = loadSettings();
let commandCodeApiKeyIndex = 0;

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

async function main() {
  const [command = "help", arg] = process.argv.slice(2);

  switch (command) {
    case "start":
      await start();
      break;
    case "login":
      await login(arg);
      break;
    case "accounts":
      listAccounts();
      break;
    case "config":
      console.log(writeConfig());
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function start() {
  writeConfig();
  await killOrphanedBackend();
  startBackend();
  startFrontendProxy();
  startDashboard();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function startBackend() {
  const binary = cliBinaryPath();
  if (!fs.existsSync(binary)) {
    throw new Error(`Missing cli-proxy-api.exe at ${binary}`);
  }

  backendProcess = spawn(binary, ["--config", CONFIG_PATH], {
    cwd: path.dirname(binary),
    windowsHide: true,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  pushLog(`CLIProxyAPI listening on http://${BACKEND_HOST}:${BACKEND_PORT} (pid ${backendProcess.pid})`);
  backendProcess.stdout.on("data", (chunk) => logBackend(chunk));
  backendProcess.stderr.on("data", (chunk) => logBackend(chunk));
  backendProcess.on("exit", (code) => {
    pushLog(`CLIProxyAPI exited with code ${code}`);
    backendProcess = null;
  });
}

function startFrontendProxy() {
  frontendServer = http.createServer((clientReq, clientRes) => {
    handleProxyRequest(clientReq, clientRes).catch((error) => {
      console.error(error.stack || error.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { "content-type": "application/json" });
      }
      clientRes.end(JSON.stringify({ error: "proxy_error", message: error.message }));
    });
  });

  frontendServer.listen(FRONTEND_PORT, FRONTEND_HOST, () => {
    pushLog(`DroidProxy frontend listening on http://${FRONTEND_HOST}:${FRONTEND_PORT}`);
    pushLog(`Use ${proxyBaseUrl()} in Droid/Factory`);
  });
}

function startDashboard() {
  dashboardServer = http.createServer((req, res) => {
    handleDashboardRequest(req, res).catch((error) => {
      pushLog(error.stack || error.message);
      sendJSON(res, 500, { error: "dashboard_error", message: error.message });
    });
  });

  dashboardServer.listen(DASHBOARD_PORT, DASHBOARD_HOST, () => {
    pushLog(`Dashboard listening on http://${DASHBOARD_HOST}:${DASHBOARD_PORT}`);
    pushLog(`Open dashboard at ${dashboardUrl()}`);
  });
}

async function handleProxyRequest(clientReq, clientRes) {
  const chunks = [];
  for await (const chunk of clientReq) {
    chunks.push(chunk);
  }

  const originalBody = Buffer.concat(chunks);
  let body = originalBody;
  let parsedBody = parseJSONBody(originalBody);
  let targetPath = rewriteGeminiResponsesPath(clientReq.url || "/", parsedBody);
  let headers = { ...clientReq.headers };

  if (clientReq.method === "GET" && isModelsPath(targetPath)) {
    await handleModelsProxyRequest(clientRes);
    return;
  }

  delete headers.host;
  delete headers["content-length"];

  headers = rewriteClaudeThinkingBetas(headers, parsedBody);

  const fastModeResult = processOpenAIFastMode(targetPath, body, parsedBody);
  if (fastModeResult.changed) {
    body = Buffer.from(fastModeResult.body, "utf8");
    parsedBody = fastModeResult.parsedBody;
  }

  if (clientReq.method === "POST" && isChatCompletionsPath(targetPath) && isCommandCodeModel(parsedBody?.model)) {
    await handleCommandCodeRequest(parsedBody, clientRes);
    return;
  }

  if (body.length > 0) {
    headers["content-length"] = Buffer.byteLength(body);
  }

  logRequestReasoning(parsedBody);

  await forwardRequest({
    method: clientReq.method,
    path: targetPath,
    headers,
    body,
    clientRes
  });
}

async function handleModelsProxyRequest(clientRes) {
  let backendModels = [];
  try {
    const payload = await requestJSON({
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      path: "/v1/models",
      timeoutMs: 5000
    });
    backendModels = Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    pushLog(`Backend models unavailable: ${error.message}`);
  }

  sendJSON(clientRes, 200, {
    object: "list",
    data: backendModels.concat(commandCodeOpenAIModels())
  });
}

async function handleCommandCodeRequest(parsedBody, clientRes) {
  const apiKeys = commandCodeApiKeys();
  if (apiKeys.length === 0) {
    sendJSON(clientRes, 401, {
      error: "commandcode_auth_missing",
      message: `Set DROIDPROXY_COMMANDCODE_API_KEYS, DROIDPROXY_COMMANDCODE_API_KEY, or login with CommandCode so ${COMMANDCODE_AUTH_PATH} contains apiKey/apiKeys.`
    });
    return;
  }

  const upstreamModel = commandCodeUpstreamModel(parsedBody.model);
  const wantsStream = parsedBody.stream !== false;
  const commandBody = openAIToCommandCode(upstreamModel, parsedBody, true);
  const response = await fetchCommandCodeWithApiKeys(apiKeys, JSON.stringify(commandBody));

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    sendJSON(clientRes, response.status || 502, {
      error: "commandcode_upstream_error",
      status: response.status,
      message: text.slice(0, 1000)
    });
    return;
  }

  if (wantsStream) {
    await streamCommandCodeAsOpenAI(response, upstreamModel, clientRes);
    return;
  }

  const completion = await collectCommandCodeCompletion(response, upstreamModel);
  sendJSON(clientRes, 200, completion);
}

async function fetchCommandCodeWithApiKeys(apiKeys, body) {
  let lastError = null;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const selection = nextCommandCodeApiKey(apiKeys);

    try {
      const response = await fetch(COMMANDCODE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${selection.apiKey}`,
          "x-session-id": crypto.randomUUID(),
          "x-command-code-version": "0.25.7",
          "x-cli-environment": "cli"
        },
        body
      });

      if (response.ok || !shouldRetryCommandCodeStatus(response.status) || attempt === apiKeys.length - 1) {
        return response;
      }

      await response.text().catch(() => "");
      pushLog(`CommandCode key ${selection.index + 1}/${apiKeys.length} returned HTTP ${response.status}; trying next key`);
    } catch (error) {
      lastError = error;
      if (attempt === apiKeys.length - 1) throw error;
      pushLog(`CommandCode key ${selection.index + 1}/${apiKeys.length} failed: ${error.message}; trying next key`);
    }
  }

  throw lastError || new Error("No CommandCode API key attempt was made");
}

function nextCommandCodeApiKey(apiKeys) {
  const index = commandCodeApiKeyIndex % apiKeys.length;
  commandCodeApiKeyIndex = (commandCodeApiKeyIndex + 1) % apiKeys.length;
  return { apiKey: apiKeys[index], index };
}

function shouldRetryCommandCodeStatus(status) {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

async function streamCommandCodeAsOpenAI(response, model, clientRes) {
  clientRes.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "access-control-allow-origin": "*"
  });

  const decoder = new TextDecoder();
  const state = { model };
  let buffer = "";

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

async function collectCommandCodeCompletion(response, model) {
  const decoder = new TextDecoder();
  const state = { model };
  let buffer = "";
  let content = "";
  let reasoning = "";
  let finishReason = "stop";
  let usage = null;

  const consume = (line) => {
    const chunks = convertCommandCodeToOpenAI(line, state) || [];
    for (const chunk of chunks) {
      const choice = chunk.choices && chunk.choices[0];
      const delta = choice && choice.delta || {};
      if (delta.content) content += delta.content;
      if (delta.reasoning_content) reasoning += delta.reasoning_content;
      if (choice && choice.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) usage = chunk.usage;
    }
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) consume(line);
  }
  if (buffer.trim()) consume(buffer.trim());

  const message = { role: "assistant", content };
  if (reasoning) message.reasoning_content = reasoning;
  const result = {
    id: state.responseId || `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: state.created || Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }]
  };
  if (usage) result.usage = usage;
  return result;
}

function writeOpenAIChunks(clientRes, chunks) {
  if (!chunks) return;
  for (const chunk of Array.isArray(chunks) ? chunks : [chunks]) {
    if (chunk) clientRes.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
}

function openAIToCommandCode(model, body, stream) {
  const { messages, system } = commandCodeMessages(body.messages);
  const params = {
    model,
    messages,
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
      workingDir: process.cwd(),
      date: today,
      environment: process.platform,
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

function commandCodeMessages(messages = []) {
  const converted = [];
  const system = [];

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
      const content = [];
      const text = contentText(message.content);
      if (text) content.push({ type: "text", text });
      if (Array.isArray(message.tool_calls)) {
        for (const toolCall of message.tool_calls) {
          const fn = toolCall.function || {};
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

function commandCodeUserContent(content) {
  if (content == null) return [{ type: "text", text: "" }];
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [{ type: "text", text: String(content) }];

  const blocks = [];
  for (const item of content) {
    if (typeof item === "string") {
      blocks.push({ type: "text", text: item });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    if (item.type === "text" && typeof item.text === "string") {
      blocks.push({ type: "text", text: item.text });
    } else if (item.type === "image_url") {
      blocks.push({ type: "image", image: item.image_url?.url || "" });
    } else if (item.type === "image") {
      blocks.push({ type: "image", image: commandCodeImageValue(item) });
    } else if (typeof item.text === "string") {
      blocks.push({ type: "text", text: item.text });
    }
  }
  return blocks.length ? blocks : [{ type: "text", text: "" }];
}

function commandCodeImageValue(item) {
  if (typeof item.image === "string") return item.image;
  if (typeof item.url === "string") return item.url;
  if (item.source?.data) {
    const mediaType = item.source.media_type || item.source.mime_type || "image/png";
    return `data:${mediaType};base64,${item.source.data}`;
  }
  if (typeof item.data === "string") {
    const mediaType = item.media_type || item.mime_type || "image/png";
    return item.data.startsWith("data:") ? item.data : `data:${mediaType};base64,${item.data}`;
  }
  return "";
}

function contentText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const item of content) {
      if (typeof item === "string") parts.push(item);
      else if (item && typeof item === "object" && typeof item.text === "string") parts.push(item.text);
    }
    return parts.join("\n");
  }
  return String(content);
}

function parseToolArguments(value) {
  if (value == null) return {};
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function commandCodeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const converted = [];
  for (const tool of tools) {
    if (!tool) continue;
    if (tool.type === "function" && tool.function) {
      converted.push({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters || { type: "object" }
      });
    } else if (tool.name && (tool.input_schema || tool.parameters)) {
      converted.push({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema || tool.parameters
      });
    }
  }
  return converted.length ? converted : undefined;
}

function commandCodeReasoningEffort(model, body) {
  const explicit = normalizeCommandCodeEffort(
    body.reasoning_effort
    || body.reasoningEffort
    || body.reasoning?.effort
    || body.thinking?.effort
    || body.thinking?.budget
  );
  if (explicit) return explicit;

  const configured = commandCodeConfiguredEfforts();
  return normalizeCommandCodeEffort(configured[model]);
}

function normalizeCommandCodeEffort(value) {
  const text = String(value || "").toLowerCase();
  return ["low", "medium", "high", "xhigh", "max"].includes(text) ? text : "";
}

function commandCodeConfiguredEfforts() {
  try {
    const configPath = path.join(os.homedir(), ".commandcode", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return config && typeof config.reasoningEffort === "object" ? config.reasoningEffort : {};
  } catch {
    return {};
  }
}

function convertCommandCodeToOpenAI(event, state) {
  if (!event) return null;
  if (event && typeof event === "object" && event.object === "chat.completion.chunk") return event;

  let data = event;
  if (typeof event === "string") {
    const trimmed = event.trim();
    if (!trimmed) return null;
    const payload = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
    if (!payload || payload === "[DONE]") return null;
    try {
      data = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || !data.type) return null;

  initCommandCodeStreamState(state, data.model);
  const chunks = [];
  const push = (delta, finishReason = null) => chunks.push(openAIChunk(state, delta, finishReason));

  switch (data.type) {
    case "text-delta": {
      const text = data.text || data.delta || "";
      if (text) {
        push(state.chunkIndex === 0 ? { role: "assistant", content: text } : { content: text });
        state.chunkIndex += 1;
      }
      break;
    }
    case "reasoning-delta": {
      const text = data.text || "";
      if (text) {
        push(state.chunkIndex === 0 ? { role: "assistant", reasoning_content: text } : { reasoning_content: text });
        state.chunkIndex += 1;
      }
      break;
    }
    case "tool-input-start": {
      const id = data.id || data.toolCallId || `call_${Date.now()}_${state.toolIndex}`;
      let index = state.toolIndexById.get(id);
      if (index == null) {
        index = state.toolIndex++;
        state.toolIndexById.set(id, index);
      }
      push({
        ...(state.chunkIndex === 0 ? { role: "assistant" } : {}),
        tool_calls: [{
          index,
          id,
          type: "function",
          function: { name: data.toolName || "", arguments: "" }
        }]
      });
      state.chunkIndex += 1;
      break;
    }
    case "tool-input-delta": {
      const index = state.toolIndexById.get(data.id || data.toolCallId);
      if (index != null) {
        push({ tool_calls: [{ index, function: { arguments: data.delta || data.inputTextDelta || "" } }] });
      }
      break;
    }
    case "tool-call": {
      const id = data.toolCallId || data.id || `call_${Date.now()}_${state.toolIndex}`;
      if (!state.toolIndexById.has(id)) {
        const index = state.toolIndex++;
        state.toolIndexById.set(id, index);
        const args = typeof data.input === "string" ? data.input : JSON.stringify(data.input ?? {});
        push({
          ...(state.chunkIndex === 0 ? { role: "assistant" } : {}),
          tool_calls: [{
            index,
            id,
            type: "function",
            function: { name: data.toolName || "", arguments: args }
          }]
        });
        state.chunkIndex += 1;
      }
      break;
    }
    case "finish-step":
      state.finishReason = commandCodeFinishReason(data.finishReason);
      if (data.usage) state.usage = data.usage;
      break;
    case "finish": {
      const finishReason = state.finishReason || commandCodeFinishReason(data.finishReason || "stop");
      const chunk = openAIChunk(state, {}, finishReason);
      const usage = data.totalUsage || state.usage;
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

function initCommandCodeStreamState(state, model) {
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

function openAIChunk(state, delta, finishReason = null) {
  return {
    id: state.responseId,
    object: "chat.completion.chunk",
    created: state.created,
    model: state.model,
    choices: [{ index: 0, delta, finish_reason: finishReason }]
  };
}

function commandCodeFinishReason(reason) {
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
      return reason || "stop";
  }
}

function commandCodeUsage(usage) {
  const prompt = usage.inputTokens ?? 0;
  const completion = usage.outputTokens ?? 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: usage.totalTokens ?? prompt + completion
  };
}

function forwardRequest({ method, path: requestPath, headers, body, clientRes }) {
  return new Promise((resolve, reject) => {
    const upstreamReq = http.request({
      host: BACKEND_HOST,
      port: BACKEND_PORT,
      method,
      path: requestPath,
      headers
    }, (upstreamRes) => {
      clientRes.writeHead(upstreamRes.statusCode || 502, upstreamRes.statusMessage, upstreamRes.headers);
      upstreamRes.pipe(clientRes);
      upstreamRes.on("end", resolve);
    });

    upstreamReq.on("error", reject);
    if (body.length > 0) {
      upstreamReq.write(body);
    }
    upstreamReq.end();
  });
}

async function handleDashboardRequest(req, res) {
  const url = new URL(req.url || "/", `http://${requestHost(DASHBOARD_HOST)}:${DASHBOARD_PORT}`);

  if (url.pathname.startsWith("/api/")) {
    await handleDashboardAPI(req, res, url);
    return;
  }

  serveDashboardAsset(url.pathname, res);
}

async function handleDashboardAPI(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/status") {
    sendJSON(res, 200, statusPayload());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/accounts") {
    sendJSON(res, 200, { accounts: getAccounts() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/logs") {
    sendJSON(res, 200, { logs: appLogs });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const configuredCommandCodeKeys = commandCodeApiKeyEntries();
    const commandCodeKeyCount = configuredCommandCodeKeys.length;
    const savedCommandCodeKeys = savedCommandCodeApiKeys();
    sendJSON(res, 200, {
      configPath: CONFIG_PATH,
      authDir: AUTH_DIR,
      commandCodeAuthPath: COMMANDCODE_AUTH_PATH,
      commandCodeAuth: commandCodeKeyCount > 0,
      commandCodeApiKeyCount: commandCodeKeyCount,
      configuredCommandCodeApiKeys: configuredCommandCodeKeys.map((entry) => ({
        key: maskApiKey(entry.apiKey),
        source: entry.source
      })),
      savedCommandCodeApiKeyCount: savedCommandCodeKeys.length,
      savedCommandCodeApiKeys: savedCommandCodeKeys.map(maskApiKey),
      commandCodeUrl: COMMANDCODE_API_URL,
      factorySettingsPath: FACTORY_SETTINGS_PATH,
      managementUrl: MANAGEMENT_URL,
      managementSecretKey: settings.managementSecretKey,
      debug: envFlag("DROIDPROXY_DEBUG"),
      gpt54FastMode: envFlag("DROIDPROXY_GPT54_FAST_MODE"),
      gpt55FastMode: envFlag("DROIDPROXY_GPT55_FAST_MODE"),
      requestRetry: process.env.DROIDPROXY_REQUEST_RETRY || "3",
      requestTimeout: process.env.DROIDPROXY_REQUEST_TIMEOUT || "10m"
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/commandcode-keys") {
    const body = await readJSONRequest(req);
    const input = typeof body.keys === "string" ? body.keys : "";
    const keys = parseCommandCodeApiKeys(input);
    settings.commandCodeApiKeys = keys;
    saveSettings();
    commandCodeApiKeyIndex = 0;
    sendJSON(res, 200, {
      count: keys.length,
      keys: keys.map(maskApiKey)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/factory-models") {
    sendJSON(res, 200, factoryModelsStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/factory-models/selection") {
    const body = await readJSONRequest(req);
    const ids = Array.isArray(body.ids) ? body.ids : null;
    if (!ids) {
      sendJSON(res, 400, { error: "invalid_selection" });
      return;
    }
    saveFactoryModelSelection(ids);
    sendJSON(res, 200, factoryModelsStatus());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-management") {
    openPath(MANAGEMENT_URL);
    sendJSON(res, 202, { opened: true, url: MANAGEMENT_URL });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/models") {
    try {
      const models = await fetchModels();
      sendJSON(res, 200, { models });
    } catch (error) {
      sendJSON(res, 502, { error: "models_unavailable", message: error.message, models: [] });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readJSONRequest(req);
    const provider = body.provider;
    if (!provider || !LOGIN_FLAGS[provider]) {
      sendJSON(res, 400, { error: "invalid_provider", providers: Object.keys(LOGIN_FLAGS) });
      return;
    }
    runLoginDetached(provider);
    sendJSON(res, 202, { started: true, provider });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-auth-dir") {
    openPath(AUTH_DIR);
    sendJSON(res, 202, { opened: true, path: AUTH_DIR });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/open-config") {
    writeConfig();
    openPath(CONFIG_PATH);
    sendJSON(res, 202, { opened: true, path: CONFIG_PATH });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/apply-factory-models") {
    const result = applyFactoryCustomModels();
    sendJSON(res, 200, result);
    return;
  }

  sendJSON(res, 404, { error: "not_found" });
}

function serveDashboardAsset(pathname, res) {
  const assetName = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const assetPath = path.resolve(DASHBOARD_DIR, assetName);

  if (!assetPath.startsWith(DASHBOARD_DIR) || !fs.existsSync(assetPath) || fs.statSync(assetPath).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  res.writeHead(200, { "content-type": contentTypeFor(assetPath) });
  fs.createReadStream(assetPath).pipe(res);
}

function statusPayload() {
  return {
    backend: {
      running: Boolean(backendProcess && !backendProcess.killed),
      pid: backendProcess ? backendProcess.pid : null,
      url: `http://${BACKEND_HOST}:${BACKEND_PORT}`
    },
    proxy: {
      running: Boolean(frontendServer && frontendServer.listening),
      url: proxyUrl(),
      bindUrl: `http://${FRONTEND_HOST}:${FRONTEND_PORT}`,
      baseUrl: proxyBaseUrl()
    },
    dashboard: {
      running: Boolean(dashboardServer && dashboardServer.listening),
      url: dashboardUrl(),
      bindUrl: `http://${DASHBOARD_HOST}:${DASHBOARD_PORT}`
    },
    management: {
      url: MANAGEMENT_URL,
      secretKey: settings.managementSecretKey
    },
    configPath: CONFIG_PATH,
    authDir: AUTH_DIR
  };
}

function sendJSON(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

async function readJSONRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {};
  return JSON.parse(body);
}

function contentTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js": return "text/javascript; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".png": return "image/png";
    case ".ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

function rewriteClaudeThinkingBetas(headers, parsedBody) {
  if (!parsedBody || !isClaudeModel(parsedBody.model) || !hasEnabledThinking(parsedBody)) {
    return headers;
  }

  const betaHeaderName = findHeaderName(headers, "anthropic-beta") || "anthropic-beta";
  const existing = String(headers[betaHeaderName] || "");
  const betas = existing
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => value.toLowerCase() !== CLAUDE_REDACTED_THINKING_BETA);

  for (const beta of CLAUDE_VISIBLE_THINKING_BETAS) {
    if (!betas.some((value) => value.toLowerCase() === beta.toLowerCase())) {
      betas.push(beta);
    }
  }

  headers[betaHeaderName] = betas.join(",");
  return headers;
}

function rewriteGeminiResponsesPath(requestPath, parsedBody) {
  if (!parsedBody || !isGeminiOAuthCodeAssistModel(parsedBody.model)) {
    return requestPath;
  }

  const [pathname, query = ""] = requestPath.split("?", 2);
  if (pathname !== "/v1/responses" && pathname !== "/api/v1/responses") {
    return requestPath;
  }

  return `/v1/chat/completions${query ? `?${query}` : ""}`;
}

function processOpenAIFastMode(requestPath, body, parsedBody) {
  if (!isResponsesAPIPath(requestPath) || !parsedBody || parsedBody.service_tier !== undefined) {
    return { changed: false };
  }

  const model = String(parsedBody.model || "");
  const enabled = (model === "gpt-5.4" && envFlag("DROIDPROXY_GPT54_FAST_MODE"))
    || (model === "gpt-5.5" && envFlag("DROIDPROXY_GPT55_FAST_MODE"));

  if (!enabled) {
    return { changed: false };
  }

  const source = body.toString("utf8");
  const inserted = injectTopLevelJSONField(source, `"service_tier":"priority"`);
  if (!inserted) {
    return { changed: false };
  }

  return {
    changed: true,
    body: inserted,
    parsedBody: { ...parsedBody, service_tier: "priority" }
  };
}

function isResponsesAPIPath(requestPath) {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/responses" || pathname === "/api/v1/responses";
}

function injectTopLevelJSONField(source, fieldSource) {
  const openIndex = source.indexOf("{");
  if (openIndex < 0) return null;

  let i = openIndex + 1;
  while (i < source.length && /\s/.test(source[i])) i += 1;

  const needsComma = source[i] !== "}";
  return `${source.slice(0, i)}${fieldSource}${needsComma ? "," : ""}${source.slice(i)}`;
}

function logRequestReasoning(parsedBody) {
  if (!parsedBody || typeof parsedBody !== "object") return;

  const fields = {};
  for (const key of ["reasoning", "reasoning_effort", "thinking", "output_config", "service_tier", "generationConfig"]) {
    if (parsedBody[key] !== undefined) fields[key] = parsedBody[key];
  }

  const model = parsedBody.model || "unknown";
  const summary = Object.keys(fields).map((key) => `${key}=${JSON.stringify(fields[key])}`).join(" ");
  const line = `REQUEST REASONING: model=${model}${summary ? ` ${summary}` : ""}`;
  appendDebugLog(line);
}

async function login(provider) {
  if (!provider || !LOGIN_FLAGS[provider]) {
    throw new Error(`Usage: node src/cli.js login <${Object.keys(LOGIN_FLAGS).join("|")}>`);
  }

  await runLogin(provider, { stdio: ["pipe", "inherit", "inherit"], windowsHide: false, wait: true });
}

function listAccounts() {
  const accounts = getAccounts();

  if (accounts.length === 0) {
    console.log("No accounts found.");
    return;
  }

  for (const account of accounts) {
    console.log(`${account.type}\t${account.email}\t${account.file}${account.disabled ? "\tdisabled" : ""}`);
  }
}

function getAccounts() {
  if (!fs.existsSync(AUTH_DIR)) {
    return [];
  }

  return fs.readdirSync(AUTH_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => readAccount(file))
    .filter(Boolean);
}

function readAccount(file) {
  try {
    const filePath = path.join(AUTH_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      file,
      type: data.type || "unknown",
      email: data.email || data.login || file,
      disabled: Boolean(data.disabled)
    };
  } catch {
    return null;
  }
}

function runLoginDetached(provider) {
  runLogin(provider, { stdio: ["pipe", "pipe", "pipe"], windowsHide: false, wait: false }).catch((error) => {
    pushLog(`Failed to start ${provider} login: ${error.message}`);
  });
}

function runLogin(provider, options) {
  writeConfig();
  const binary = cliBinaryPath();
  if (!fs.existsSync(binary)) {
    throw new Error(`Missing cli-proxy-api.exe at ${binary}`);
  }

  const args = ["--config", CONFIG_PATH, LOGIN_FLAGS[provider]];
  pushLog(`Starting ${provider} OAuth login`);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: path.dirname(binary),
      windowsHide: options.windowsHide,
      env: process.env,
      stdio: options.stdio
    });

    if (child.stdout) child.stdout.on("data", (chunk) => logBackend(chunk));
    if (child.stderr) child.stderr.on("data", (chunk) => logBackend(chunk));

    if (provider === "codex") {
      setTimeout(() => {
        if (!child.killed && child.stdin) child.stdin.write("\n");
      }, 12000);
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      pushLog(`${provider} login exited with code ${code}`);
      if (!options.wait || code === 0) resolve();
      else reject(new Error(`${provider} login exited with code ${code}`));
    });

    if (!options.wait) {
      resolve();
    }
  });
}

async function fetchModels() {
  const payload = await requestJSON({
    host: requestHost(FRONTEND_HOST),
    port: FRONTEND_PORT,
    path: "/v1/models",
    timeoutMs: 5000
  });
  return Array.isArray(payload.data) ? payload.data : commandCodeOpenAIModels();
}

function requestJSON({ host, port, path: requestPath, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path: requestPath, method: "GET", timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if ((res.statusCode || 500) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.end();
  });
}

function openPath(targetPath) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  execFile("explorer.exe", [targetPath], { windowsHide: true }, (error) => {
    if (error) pushLog(`Failed to open ${targetPath}: ${error.message}`);
  });
}

function factoryModelsStatus() {
  const enabledModels = droidProxySettingsModels();
  const selectedIds = getFactoryModelSelection();
  const expectedIds = new Set(enabledModels.map((model) => model.id));
  const selectedExpectedIds = new Set(enabledModels.filter((model) => selectedIds.includes(model.id)).map((model) => model.id));
  const settings = readFactorySettings();
  const models = Array.isArray(settings.customModels) ? settings.customModels : [];
  const installedIds = new Set(models
    .map((model) => model && model.id)
    .filter((id) => typeof id === "string")
    .filter(isDroidProxyModelId));

  return {
    installed: selectedExpectedIds.size > 0 && setEquals(installedIds, selectedExpectedIds),
    expectedCount: expectedIds.size,
    selectedCount: selectedExpectedIds.size,
    installedCount: installedIds.size,
    settingsPath: FACTORY_SETTINGS_PATH,
    selectedIds,
    models: enabledModels
  };
}

function applyFactoryCustomModels() {
  fs.mkdirSync(path.dirname(FACTORY_SETTINGS_PATH), { recursive: true });

  const settings = readFactorySettings();
  const existingModels = Array.isArray(settings.customModels) ? settings.customModels : [];
  const retainedModels = existingModels.filter((model) => {
    const id = model && model.id;
    return typeof id !== "string" || !isDroidProxyModelId(id);
  });

  const startIndex = retainedModels.length;
  const selectedIds = getFactoryModelSelection();
  const nextModels = droidProxySettingsModels()
    .filter((model) => selectedIds.includes(model.id))
    .map((model, offset) => ({
    ...model,
    index: startIndex + offset
  }));

  settings.customModels = retainedModels.concat(nextModels);
  const backupPath = backupFactorySettingsIfPresent();
  fs.writeFileSync(FACTORY_SETTINGS_PATH, `${JSON.stringify(settings, null, 2).replaceAll("\\/", "/")}\n`);

  pushLog(`Applied ${nextModels.length} DroidProxy custom models to ${FACTORY_SETTINGS_PATH}`);
  if (backupPath) pushLog(`Backed up Factory settings to ${backupPath}`);

  return {
    applied: true,
    count: nextModels.length,
    settingsPath: FACTORY_SETTINGS_PATH,
    backupPath
  };
}

function getFactoryModelSelection() {
  const allIds = droidProxySettingsModels().map((model) => model.id);
  if (!Array.isArray(settings.factoryModelIds)) {
    settings.factoryModelIds = [...allIds];
    saveSettings();
    return settings.factoryModelIds;
  }

  const valid = settings.factoryModelIds.filter((id) => allIds.includes(id));
  if (valid.length !== settings.factoryModelIds.length) {
    settings.factoryModelIds = valid;
    saveSettings();
  }

  return settings.factoryModelIds;
}

function saveFactoryModelSelection(ids) {
  const allIds = new Set(droidProxySettingsModels().map((model) => model.id));
  settings.factoryModelIds = [...new Set(ids.filter((id) => allIds.has(id)))];
  saveSettings();
}

function readFactorySettings() {
  try {
    return JSON.parse(fs.readFileSync(FACTORY_SETTINGS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function backupFactorySettingsIfPresent() {
  if (!fs.existsSync(FACTORY_SETTINGS_PATH)) return null;

  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replace("T", "-")
    .replaceAll(":", "")
    .replace(/\..*$/, "");
  const backupPath = path.join(path.dirname(FACTORY_SETTINGS_PATH), `settings.json.droidproxy-${timestamp}.bak`);
  fs.copyFileSync(FACTORY_SETTINGS_PATH, backupPath);
  return backupPath;
}

function isDroidProxyModelId(id) {
  return DROIDPROXY_MODEL_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function setEquals(left, right) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

function droidProxySettingsModels() {
  return DROIDPROXY_MODEL_DEFINITIONS.map((definition) => {
    const entry = {
      model: definition.baseModel,
      id: `custom:droidproxy:${definition.idSlug}`,
      baseUrl: definition.baseUrl,
      apiKey: "dummy-not-used",
      displayName: `DroidProxy: ${definition.kind === "antigravity" ? `Antigravity: ${definition.displayName}` : definition.displayName}`,
      maxOutputTokens: definition.maxOutputTokens,
      noImageSupport: Boolean(definition.noImageSupport),
      provider: definition.provider
    };

    if (definition.levels.length > 0) {
      entry.enableThinking = true;
      entry.supportedReasoningEfforts = definition.levels;
      entry.defaultReasoningEffort = definition.defaultLevel;
      entry.reasoningEffort = definition.levels.length === 1 ? definition.levels[0] : definition.defaultLevel;
    } else if (definition.reasoning) {
      entry.enableThinking = true;
    }

    return entry;
  });
}

function buildDroidProxyModelDefinitions() {
  const low = "low";
  const medium = "medium";
  const high = "high";
  const xhigh = "xhigh";
  const max = "max";
  const claudeAdvancedLevels = [low, medium, high, xhigh, max];
  const claudeSonnetLevels = [low, medium, high, max];
  const codexLevels = [low, medium, high, xhigh];
  const xaiLevels = [low, medium, high];

  const antigravityModel = ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens = 65536,
    levels = [high],
    defaultLevel = high
  }) => ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens,
    provider: "openai",
    providerKey: "antigravity",
    baseUrl: proxyBaseUrl(),
    kind: "antigravity",
    levels,
    defaultLevel
  });

  const xaiModel = ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens = 131072,
    levels = xaiLevels,
    defaultLevel = high
  }) => ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens,
    provider: "openai",
    providerKey: "xai",
    baseUrl: proxyBaseUrl(),
    kind: "xai",
    levels,
    defaultLevel
  });

  const commandCodeModel = ({ id, name, maxOutputTokens = 64000, levels = [], defaultLevel = null, vision = false, reasoning = false, droidModel = null }) => {
    const effectiveLevels = levels.length > 0 ? levels : (reasoning ? [high] : []);
    const effectiveDefaultLevel = defaultLevel || effectiveLevels[0] || null;
    const isAnthropic = String(id).startsWith("claude-");

    return {
      baseModel: `commandcode:${droidModel || id}`,
      idSlug: `commandcode-${commandCodeSlug(id)}`,
      displayName: `CommandCode: ${name}`,
      maxOutputTokens,
      provider: isAnthropic ? "anthropic" : "generic-chat-completion-api",
      providerKey: "commandcode",
      baseUrl: isAnthropic ? proxyUrl() : proxyBaseUrl(),
      kind: "commandcode",
      noImageSupport: !vision,
      reasoning,
      levels: effectiveLevels,
      defaultLevel: effectiveDefaultLevel
    };
  };

  return [
    ...COMMANDCODE_MODELS.map(commandCodeModel),
    {
      baseModel: "claude-fable-5",
      idSlug: "fable-5",
      displayName: "Fable 5",
      maxOutputTokens: 128000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl(),
      kind: "claudeAdaptive",
      levels: claudeAdvancedLevels,
      defaultLevel: xhigh
    },
    {
      baseModel: "claude-opus-4-8",
      idSlug: "opus-4-8",
      displayName: "Opus 4.8",
      maxOutputTokens: 128000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl(),
      kind: "claudeAdaptive",
      levels: claudeAdvancedLevels,
      defaultLevel: xhigh
    },
    {
      baseModel: "claude-sonnet-4-6",
      idSlug: "sonnet-4-6",
      displayName: "Sonnet 4.6",
      maxOutputTokens: 64000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl(),
      kind: "claudeAdaptive",
      levels: claudeSonnetLevels,
      defaultLevel: high
    },
    {
      baseModel: "gpt-5.4",
      idSlug: "gpt-5.4",
      displayName: "GPT 5.4",
      maxOutputTokens: 128000,
      provider: "openai",
      providerKey: "codex",
      baseUrl: proxyBaseUrl(),
      kind: "codex",
      levels: codexLevels,
      defaultLevel: high
    },
    {
      baseModel: "gpt-5.5",
      idSlug: "gpt-5.5",
      displayName: "GPT 5.5",
      maxOutputTokens: 128000,
      provider: "openai",
      providerKey: "codex",
      baseUrl: proxyBaseUrl(),
      kind: "codex",
      levels: codexLevels,
      defaultLevel: high
    },
    antigravityModel({
      baseModel: "gemini-pro-agent",
      idSlug: "antigravity-gemini-3.1-pro",
      displayName: "Gemini 3.1 Pro (High)"
    }),
    antigravityModel({
      baseModel: "gemini-3.1-pro-low",
      idSlug: "gemini-3.1-pro-low",
      displayName: "Gemini 3.1 Pro (Low)",
      levels: [low],
      defaultLevel: low
    }),
    antigravityModel({
      baseModel: "gemini-3-flash",
      idSlug: "antigravity-gemini-3-flash",
      displayName: "Gemini 3 Flash"
    }),
    antigravityModel({
      baseModel: "gemini-3-flash-agent",
      idSlug: "gemini-3.5-flash",
      displayName: "Gemini 3.5 Flash",
      levels: [medium, high],
      defaultLevel: high
    }),
    antigravityModel({
      baseModel: "gemini-3.5-flash-low",
      idSlug: "gemini-3.5-flash-low",
      displayName: "Gemini 3.5 Flash (Low)",
      levels: [low],
      defaultLevel: low
    }),
    antigravityModel({
      baseModel: "gemini-3.1-flash-lite",
      idSlug: "gemini-3.1-flash-lite",
      displayName: "Gemini 3.1 Flash Lite"
    }),
    antigravityModel({
      baseModel: "ag-c46s-thinking",
      idSlug: "ag-c46s-thinking",
      displayName: "Claude Sonnet 4.6 (Thinking)",
      maxOutputTokens: 64000
    }),
    antigravityModel({
      baseModel: "ag-c46o-thinking",
      idSlug: "ag-c46o-thinking",
      displayName: "Claude Opus 4.6 (Thinking)",
      maxOutputTokens: 64000
    }),
    antigravityModel({
      baseModel: "gpt-oss-120b-medium",
      idSlug: "gpt-oss-120b-medium",
      displayName: "GPT-OSS 120B (Medium)",
      maxOutputTokens: 32768,
      levels: [medium],
      defaultLevel: medium
    }),
    {
      baseModel: "kimi-k2.6",
      idSlug: "kimi-k2.6",
      displayName: "Kimi K2.6",
      maxOutputTokens: 262144,
      provider: "openai",
      providerKey: "kimi",
      baseUrl: proxyBaseUrl(),
      kind: "kimi",
      levels: [high],
      defaultLevel: high
    },
    xaiModel({
      baseModel: "grok-4.20-0309-reasoning",
      idSlug: "grok-4.20-0309-reasoning",
      displayName: "Grok 4.20 Reasoning"
    }),
    xaiModel({
      baseModel: "grok-4.20-0309-non-reasoning",
      idSlug: "grok-4.20-0309-non-reasoning",
      displayName: "Grok 4.20 Non-Reasoning",
      levels: [high]
    }),
    xaiModel({
      baseModel: "grok-4.20-multi-agent-0309",
      idSlug: "grok-4.20-multi-agent-0309",
      displayName: "Grok 4.20 Multi-Agent"
    }),
    xaiModel({
      baseModel: "grok-4.3",
      idSlug: "grok-4.3",
      displayName: "Grok 4.3"
    }),
    xaiModel({
      baseModel: "grok-build-0.1",
      idSlug: "grok-build-0.1",
      displayName: "Grok Build 0.1"
    }),
    xaiModel({
      baseModel: "grok-composer-2.5-fast",
      idSlug: "grok-composer-2.5-fast",
      displayName: "Grok Composer 2.5 Fast"
    }),
    xaiModel({
      baseModel: "grok-3-mini",
      idSlug: "grok-3-mini",
      displayName: "Grok 3 Mini"
    }),
    xaiModel({
      baseModel: "grok-3-mini-fast",
      idSlug: "grok-3-mini-fast",
      displayName: "Grok 3 Mini Fast"
    })
  ];
}

function writeConfig() {
  return writeConfigFile({
    rootDir: ROOT_DIR,
    managementSecretKey: settings.managementSecretKey,
    configPath: CONFIG_PATH,
    authDir: AUTH_DIR,
    backendPort: BACKEND_PORT
  });
}

function saveSettings() {
  persistSettings(settings, {
    settingsPath: SETTINGS_PATH,
    authDir: AUTH_DIR
  });
}

function cliBinaryPath() {
  return path.join(ROOT_DIR, "resources", "bin", "cli-proxy-api.exe");
}

function killOrphanedBackend() {
  if (!envFlag("DROIDPROXY_KILL_ORPHANED_BACKEND")) {
    pushLog("Skipping global cli-proxy-api.exe cleanup in lab mode");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    execFile("taskkill.exe", ["/IM", "cli-proxy-api.exe", "/F"], { windowsHide: true }, () => resolve());
  });
}

function shutdown() {
  if (dashboardServer) {
    dashboardServer.close();
    dashboardServer = null;
  }
  if (frontendServer) {
    frontendServer.close();
    frontendServer = null;
  }
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  process.exit(0);
}

function logBackend(chunk) {
  const text = chunk.toString().trim();
  if (text) pushLog(text);
}

function pushLog(line) {
  const text = String(line || "").trim();
  if (!text) return;
  const entry = `[${new Date().toLocaleTimeString()}] ${text}`;
  appLogs.push(entry);
  appLogs = appLogs.slice(-500);
  console.log(text);
}

function appendDebugLog(line) {
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // Debug logging must not break proxying.
  }
}

function parseJSONBody(body) {
  if (!body || body.length === 0) return null;
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

function isModelsPath(requestPath) {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/models" || pathname === "/api/v1/models";
}

function isChatCompletionsPath(requestPath) {
  const pathname = String(requestPath || "").split("?", 1)[0];
  return pathname === "/v1/chat/completions" || pathname === "/api/v1/chat/completions";
}

function isCommandCodeModel(model) {
  const value = String(model || "").toLowerCase();
  return value.startsWith("commandcode:") || value.startsWith("cmc:");
}

function commandCodeUpstreamModel(model) {
  const value = String(model || "");
  if (value.toLowerCase().startsWith("commandcode:")) return value.slice("commandcode:".length);
  if (value.toLowerCase().startsWith("cmc:")) return value.slice("cmc:".length);
  return value;
}

function commandCodeOpenAIModels() {
  const now = Math.floor(Date.now() / 1000);
  return COMMANDCODE_MODELS.map((model) => ({
    id: `commandcode:${model.id}`,
    object: "model",
    created: now,
    owned_by: "commandcode"
  }));
}

function commandCodeSlug(id) {
  return String(id || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function commandCodeApiKeys() {
  return commandCodeApiKeyEntries().map((entry) => entry.apiKey);
}

function commandCodeApiKeyEntries() {
  const entries = [];
  addCommandCodeApiKeyEntries(entries, process.env.DROIDPROXY_COMMANDCODE_API_KEYS, "Environment");
  addCommandCodeApiKeyEntries(entries, process.env.COMMANDCODE_API_KEYS, "Environment");
  addCommandCodeApiKeyEntries(entries, process.env.DROIDPROXY_COMMANDCODE_API_KEY, "Environment");
  addCommandCodeApiKeyEntries(entries, process.env.COMMANDCODE_API_KEY, "Environment");
  for (const apiKey of savedCommandCodeApiKeys()) addCommandCodeApiKeyEntries(entries, apiKey, "Dashboard");

  try {
    const auth = JSON.parse(fs.readFileSync(COMMANDCODE_AUTH_PATH, "utf8"));
    if (Array.isArray(auth?.apiKeys)) {
      for (const apiKey of auth.apiKeys) addCommandCodeApiKeyEntries(entries, apiKey, "CommandCode auth");
    }
    addCommandCodeApiKeyEntries(entries, auth?.apiKey, "CommandCode auth");
  } catch {
    // Missing auth file is fine when other key sources are configured.
  }

  const unique = new Map();
  for (const entry of entries) {
    if (!unique.has(entry.apiKey)) unique.set(entry.apiKey, entry);
  }
  return [...unique.values()];
}

function savedCommandCodeApiKeys() {
  return Array.isArray(settings.commandCodeApiKeys) ? settings.commandCodeApiKeys : [];
}

function addCommandCodeApiKeyEntries(entries, value, source) {
  for (const apiKey of parseCommandCodeApiKeys(value)) {
    entries.push({ apiKey, source });
  }
}

function hasEnabledThinking(parsedBody) {
  const type = parsedBody && parsedBody.thinking && parsedBody.thinking.type;
  return ["enabled", "adaptive", "auto"].includes(String(type || "").toLowerCase());
}

function isClaudeModel(model) {
  const value = String(model || "");
  return value.startsWith("claude-") || value.startsWith("gemini-claude-");
}

function isGeminiOAuthCodeAssistModel(model) {
  const value = String(model || "");
  return value.startsWith("gemini-") && value.endsWith("-preview");
}

function findHeaderName(headers, targetLower) {
  return Object.keys(headers).find((name) => name.toLowerCase() === targetLower);
}

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function requestHost(host) {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

function proxyUrl() {
  return `http://${advertisedHost(FRONTEND_HOST)}:${FRONTEND_PORT}`;
}

function proxyBaseUrl() {
  return `${proxyUrl()}/v1`;
}

function dashboardUrl() {
  return `http://${advertisedHost(DASHBOARD_HOST)}:${DASHBOARD_PORT}`;
}

function advertisedHost(bindHost) {
  if (bindHost === "0.0.0.0" || bindHost === "::") {
    return PUBLIC_HOST;
  }
  return bindHost;
}

function detectPublicHost() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "127.0.0.1";
}

function printHelp() {
  console.log(`DroidProxy Windows

Usage:
  node src/cli.js start
  node src/cli.js login <provider>
  node src/cli.js accounts
  node src/cli.js config

Providers:
  ${Object.keys(LOGIN_FLAGS).join(", ")}

Endpoint:
  ${proxyBaseUrl()}

Dashboard:
  ${dashboardUrl()}

Config:
  ${CONFIG_PATH}
`);
}
