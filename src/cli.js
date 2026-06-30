const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const {
  loadSettings,
  saveSettings: persistSettings,
  writeConfig: writeConfigFile,
  DEFAULT_COMMANDCODE_API_URL,
  getCommandCodeAuthPath,
  handleProxyRequest: handleProxyRequestCore,
  sendJSON,
  requestJSON,
  commandCodeOpenAIModels,
  CommandCodeApiKeyRotator,
  LOGIN_FLAGS,
  getFactorySettingsPath,
  buildDroidProxyModelDefinitions,
  droidProxySettingsModels,
  factoryModelsStatus: factoryModelsStatusCore,
  applyFactoryCustomModels: applyFactoryCustomModelsCore,
  saveFactoryModelSelection: saveFactoryModelSelectionCore,
  getAccounts,
  formatAccountsForCli,
  runLogin: runLoginCore,
  runLoginDetached: runLoginDetachedCore,
  handleDashboardRequest: handleDashboardRequestCore
} = require("@droidproxy/core");
const {
  startBackendProcess,
  stopBackendProcess,
  killOrphanedBackend: killOrphanedBackendProcess,
  resolveCliBinaryPath,
  probeBackendVersion,
  assertMinimumVersion
} = require("@droidproxy/service");
const { fetchQuotaUsage, resetCodexQuotaUsage } = require("@droidproxy/management-client");

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
const DASHBOARD_HOST = process.env.DROIDPROXY_DASHBOARD_HOST || "127.0.0.1";
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
    handleDashboardRequestCore(req, res, {
      dashboardDir: DASHBOARD_DIR,
      dashboardHost: DASHBOARD_HOST,
      dashboardPort: DASHBOARD_PORT,
      apiContext: dashboardApiContext()
    }).catch((error) => {
      pushLog(error.stack || error.message);
      sendJSON(res, 500, { error: "dashboard_error", message: error.message });
    });
  });

  dashboardServer.listen(DASHBOARD_PORT, DASHBOARD_HOST, () => {
    pushLog(`Dashboard listening on http://${DASHBOARD_HOST}:${DASHBOARD_PORT}`);
    pushLog(`Open dashboard at ${dashboardUrl()}`);
    pushLog(
      "WARNING: The :8419 browser dashboard is deprecated. Use the DroidProxy desktop app for the maintained UI."
    );
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

function dashboardApiContext() {
  return {
    authDir: AUTH_DIR,
    configPath: CONFIG_PATH,
    commandCodeAuthPath: COMMANDCODE_AUTH_PATH,
    commandCodeApiUrl: COMMANDCODE_API_URL,
    factorySettingsPath: FACTORY_SETTINGS_PATH,
    managementUrl: MANAGEMENT_URL,
    settings,
    env: process.env,
    appLogs,
    commandCodeApiKeyRotator,
    getSavedCommandCodeApiKeys: savedCommandCodeApiKeys,
    saveSettings,
    statusPayload,
    getAccounts: () => getAccounts(AUTH_DIR),
    factoryModelsStatus,
    saveFactoryModelSelection,
    applyFactoryCustomModels,
    fetchModels,
    runLoginDetached,
    openPath,
    writeConfig,
    fetchQuotaUsage: () =>
      fetchQuotaUsage({
        managementUrl: MANAGEMENT_URL,
        secretKey: settings.managementSecretKey
      }),
    resetCodexQuota: (accountName) =>
      resetCodexQuotaUsage({
        managementUrl: MANAGEMENT_URL,
        secretKey: settings.managementSecretKey,
        accountName
      })
  };
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

async function getDroidProxyModelDefinitions() {
  let discoveredModels = [];
  try {
    discoveredModels = await fetchModels();
  } catch (error) {
    pushLog(`Factory model discovery unavailable: ${error.message}`);
  }
  return buildDroidProxyModelDefinitions(factoryRuntimeContext(), discoveredModels);
}

async function enabledFactoryModels() {
  return droidProxySettingsModels(await getDroidProxyModelDefinitions());
}

async function factoryModelsStatus() {
  return factoryModelsStatusCore({
    definitions: await getDroidProxyModelDefinitions(),
    settings,
    factorySettingsPath: FACTORY_SETTINGS_PATH,
    saveSettings
  });
}

async function applyFactoryCustomModels() {
  return applyFactoryCustomModelsCore({
    definitions: await getDroidProxyModelDefinitions(),
    settings,
    factorySettingsPath: FACTORY_SETTINGS_PATH,
    saveSettings,
    onLog: pushLog
  });
}

async function saveFactoryModelSelection(ids) {
  saveFactoryModelSelectionCore(settings, ids, await enabledFactoryModels(), saveSettings);
}


function writeConfig() {
  return writeConfigFile({
    rootDir: ROOT_DIR,
    managementSecretKey: settings.managementSecretKey,
    configPath: CONFIG_PATH,
    authDir: AUTH_DIR,
    backendPort: BACKEND_PORT,
    openAICompatibleProviders: settings.openAICompatibleProviders
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
