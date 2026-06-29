const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
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
  CommandCodeApiKeyRotator,
  LOGIN_FLAGS,
  getFactorySettingsPath,
  buildDroidProxyModelDefinitions,
  droidProxySettingsModels,
  factoryModelsStatus: factoryModelsStatusCore,
  applyFactoryCustomModels: applyFactoryCustomModelsCore,
  getFactoryModelSelection: getFactoryModelSelectionCore,
  saveFactoryModelSelection: saveFactoryModelSelectionCore,
  getAccounts,
  formatAccountsForCli,
  runLogin: runLoginCore,
  runLoginDetached: runLoginDetachedCore
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
const FACTORY_SETTINGS_PATH = getFactorySettingsPath();

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

  await runLoginCore(loginOptions(provider, {
    stdio: ["pipe", "inherit", "inherit"],
    windowsHide: false,
    wait: true
  }));
}

function listAccounts() {
  console.log(formatAccountsForCli(getAccounts(AUTH_DIR)));
}

function loginOptions(provider, options) {
  return {
    rootDir: ROOT_DIR,
    configPath: CONFIG_PATH,
    provider,
    resolveBinaryPath: resolveCliBinaryPath,
    writeConfig,
    onLog: pushLog,
    onBackendLog: logBackend,
    env: process.env,
    ...options
  };
}

function runLoginDetached(provider) {
  runLoginDetachedCore(loginOptions(provider, {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: false,
    wait: false
  }));
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

function factoryRuntimeContext() {
  return {
    proxyUrl: () => proxyUrl(),
    proxyBaseUrl: () => proxyBaseUrl()
  };
}

function getDroidProxyModelDefinitions() {
  return buildDroidProxyModelDefinitions(factoryRuntimeContext());
}

function enabledFactoryModels() {
  return droidProxySettingsModels(getDroidProxyModelDefinitions());
}

function factoryModelsStatus() {
  return factoryModelsStatusCore({
    definitions: getDroidProxyModelDefinitions(),
    settings,
    factorySettingsPath: FACTORY_SETTINGS_PATH,
    saveSettings
  });
}

function applyFactoryCustomModels() {
  return applyFactoryCustomModelsCore({
    definitions: getDroidProxyModelDefinitions(),
    settings,
    factorySettingsPath: FACTORY_SETTINGS_PATH,
    saveSettings,
    onLog: pushLog
  });
}

function getFactoryModelSelection() {
  return getFactoryModelSelectionCore(settings, enabledFactoryModels(), saveSettings);
}

function saveFactoryModelSelection(ids) {
  saveFactoryModelSelectionCore(settings, ids, enabledFactoryModels(), saveSettings);
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
