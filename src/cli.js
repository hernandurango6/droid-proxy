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
  envFlag,
  COMMANDCODE_MODELS,
  DEFAULT_COMMANDCODE_API_URL,
  getCommandCodeAuthPath,
  handleProxyRequest: handleProxyRequestCore,
  sendJSON,
  requestJSON,
  commandCodeOpenAIModels,
  commandCodeSlug,
  resolveCommandCodeApiKeyEntries,
  CommandCodeApiKeyRotator
} = require("@droidproxy/core");
const {
  startBackendProcess,
  stopBackendProcess,
  killOrphanedBackend: killOrphanedBackendProcess,
  resolveCliBinaryPath,
  probeBackendVersion,
  assertMinimumVersion
} = require("@droidproxy/service");

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
const COMMANDCODE_API_URL = process.env.DROIDPROXY_COMMANDCODE_URL || DEFAULT_COMMANDCODE_API_URL;
const COMMANDCODE_AUTH_PATH = getCommandCodeAuthPath();

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
const commandCodeApiKeyRotator = new CommandCodeApiKeyRotator();

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
  await killOrphanedBackendProcess({ onLog: pushLog });
  startBackend();
  startFrontendProxy();
  startDashboard();

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function startBackend() {
  const handle = startBackendProcess({
    rootDir: ROOT_DIR,
    configPath: CONFIG_PATH,
    backendHost: BACKEND_HOST,
    backendPort: BACKEND_PORT,
    env: process.env,
    onLog: pushLog
  });

  backendProcess = handle.process;
  backendProcess.on("exit", (code) => {
    pushLog(`CLIProxyAPI exited with code ${code}`);
    backendProcess = null;
  });

  setTimeout(() => {
    probeBackendVersion(BACKEND_PORT, BACKEND_HOST)
      .then((result) => {
        pushLog(result.message);
        if (result.version) {
          assertMinimumVersion(result.version, (message) => pushLog(`WARNING: ${message}`));
        }
      })
      .catch((error) => pushLog(`Backend version probe failed: ${error.message}`));
  }, 1500);
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

function proxyRequestContext() {
  return {
    backendHost: BACKEND_HOST,
    backendPort: BACKEND_PORT,
    onLog: pushLog,
    onDebugLog: appendDebugLog,
    apiUrl: COMMANDCODE_API_URL,
    authPath: COMMANDCODE_AUTH_PATH,
    env: process.env,
    savedKeys: savedCommandCodeApiKeys(),
    rotator: commandCodeApiKeyRotator,
    cwd: process.cwd(),
    platform: process.platform
  };
}

async function handleProxyRequest(clientReq, clientRes) {
  await handleProxyRequestCore(clientReq, clientRes, proxyRequestContext());
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
    const configuredCommandCodeKeys = resolveCommandCodeApiKeyEntries({ env: process.env, savedKeys: savedCommandCodeApiKeys(), authPath: COMMANDCODE_AUTH_PATH });
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
    commandCodeApiKeyRotator.reset();
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
  const binary = resolveCliBinaryPath(ROOT_DIR);
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
    stopBackendProcess(backendProcess);
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

function savedCommandCodeApiKeys() {
  return Array.isArray(settings.commandCodeApiKeys) ? settings.commandCodeApiKeys : [];
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
