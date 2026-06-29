import { execFile } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { Server } from "node:http";
import http from "node:http";
import fs from "node:fs";
import {
  applyFactoryCustomModels as applyFactoryCustomModelsCore,
  BACKEND_HOST,
  buildDroidProxyModelDefinitions,
  CommandCodeApiKeyRotator,
  commandCodeOpenAIModels,
  CONTROL_BIND_HOST,
  createControlServer,
  droidProxySettingsModels,
  factoryModelsStatus as factoryModelsStatusCore,
  getAccounts,
  getAuthDir,
  getCommandCodeAuthPath,
  getConfigPath,
  getDebugLogPath,
  getFactorySettingsPath,
  getManagementUrl,
  getProxyBaseUrl,
  getProxyUrl,
  getSettingsPath,
  handleProxyRequest,
  loadSettings,
  requestHost,
  requestJSON,
  resolveBackendPort,
  resolveCommandCodeApiUrl,
  resolveControlPort,
  resolveFrontendHost,
  resolveFrontendPort,
  resolvePublicHost,
  runLoginDetached as runLoginDetachedCore,
  saveFactoryModelSelection as saveFactoryModelSelectionCore,
  saveSettings as persistSettings,
  writeConfig as writeConfigFile,
  type ControlHealthPayload,
  type DashboardApiContext
} from "@droidproxy/core";
import {
  assertMinimumVersion,
  killOrphanedBackend,
  probeBackendVersion,
  resolveCliBinaryPath,
  startBackendProcess,
  stopBackendProcess
} from "@droidproxy/service";
import { fetchQuotaUsage, resetCodexQuotaUsage } from "@droidproxy/management-client";
import { resolveSidecarRootDir } from "./paths";

export interface SidecarOrchestratorOptions {
  rootDir?: string;
  env?: NodeJS.ProcessEnv;
  moduleDirname?: string;
}

export class SidecarOrchestrator {
  private readonly rootDir: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly authDir = getAuthDir();
  private readonly configPath = getConfigPath();
  private readonly settingsPath = getSettingsPath();
  private readonly debugLogPath = getDebugLogPath();
  private readonly factorySettingsPath = getFactorySettingsPath();
  private readonly commandCodeAuthPath = getCommandCodeAuthPath();
  private readonly frontendHost: string;
  private readonly frontendPort: number;
  private readonly backendPort: number;
  private readonly controlPort: number;
  private readonly publicHost: string;
  private readonly commandCodeApiUrl: string;
  private readonly managementUrl: string;
  private settings = loadSettings();
  private readonly commandCodeApiKeyRotator = new CommandCodeApiKeyRotator();
  private appLogs: string[] = [];
  private backendProcess: ChildProcess | null = null;
  private frontendServer: Server | null = null;
  private controlServer: Server | null = null;

  constructor(options: SidecarOrchestratorOptions = {}) {
    this.env = options.env ?? process.env;
    this.rootDir = options.rootDir
      ?? resolveSidecarRootDir(options.moduleDirname ?? __dirname);
    this.frontendHost = resolveFrontendHost(this.env);
    this.frontendPort = resolveFrontendPort(this.env);
    this.backendPort = resolveBackendPort(this.env);
    this.controlPort = resolveControlPort(this.env);
    this.publicHost = resolvePublicHost(this.env);
    this.commandCodeApiUrl = resolveCommandCodeApiUrl(this.env);
    this.managementUrl = getManagementUrl(BACKEND_HOST, this.backendPort);
  }

  async start(): Promise<void> {
    this.writeConfig();
    await killOrphanedBackend({ onLog: (line) => this.pushLog(line) });
    this.startBackend();
    this.startFrontendProxy();
    this.startControlServer();

    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());
  }

  getHealthPayload(): ControlHealthPayload {
    const proxyRunning = Boolean(this.frontendServer?.listening);
    const backendRunning = Boolean(this.backendProcess && !this.backendProcess.killed);
    const controlRunning = Boolean(this.controlServer?.listening);
    const status = proxyRunning && backendRunning && controlRunning ? "ok" : "degraded";

    return {
      status,
      control: {
        running: controlRunning,
        url: `http://${CONTROL_BIND_HOST}:${this.controlPort}`
      },
      proxy: {
        running: proxyRunning,
        url: getProxyUrl(this.frontendHost, this.frontendPort, this.publicHost)
      },
      backend: {
        running: backendRunning,
        pid: this.backendProcess?.pid ?? null,
        url: `http://${BACKEND_HOST}:${this.backendPort}`
      }
    };
  }

  shutdown(): void {
    if (this.controlServer) {
      this.controlServer.close();
      this.controlServer = null;
    }
    if (this.frontendServer) {
      this.frontendServer.close();
      this.frontendServer = null;
    }
    if (this.backendProcess) {
      stopBackendProcess(this.backendProcess);
      this.backendProcess = null;
    }
    process.exit(0);
  }

  private startBackend(): void {
    const handle = startBackendProcess({
      rootDir: this.rootDir,
      configPath: this.configPath,
      backendHost: BACKEND_HOST,
      backendPort: this.backendPort,
      env: this.env,
      onLog: (line) => this.pushLog(line)
    });

    this.backendProcess = handle.process;
    this.backendProcess.on("exit", (code) => {
      this.pushLog(`CLIProxyAPI exited with code ${code}`);
      this.backendProcess = null;
    });

    setTimeout(() => {
      probeBackendVersion(this.backendPort, BACKEND_HOST)
        .then((result) => {
          this.pushLog(result.message);
          if (result.version) {
            assertMinimumVersion(result.version, (message) => this.pushLog(`WARNING: ${message}`));
          }
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.pushLog(`Backend version probe failed: ${message}`);
        });
    }, 1500);
  }

  private startFrontendProxy(): void {
    this.frontendServer = http.createServer((clientReq, clientRes) => {
      handleProxyRequest(clientReq, clientRes, this.proxyRequestContext()).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.pushLog(message);
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { "content-type": "application/json" });
        }
        clientRes.end(JSON.stringify({ error: "proxy_error", message }));
      });
    });

    this.frontendServer.listen(this.frontendPort, this.frontendHost, () => {
      this.pushLog(`DroidProxy frontend listening on http://${this.frontendHost}:${this.frontendPort}`);
      this.pushLog(`Use ${getProxyBaseUrl(this.frontendHost, this.frontendPort, this.publicHost)} in Droid/Factory`);
    });
  }

  private startControlServer(): void {
    this.controlServer = createControlServer({
      host: CONTROL_BIND_HOST,
      port: this.controlPort,
      apiContext: this.dashboardApiContext(),
      getHealthPayload: () => this.getHealthPayload(),
      onError: (error) => this.pushLog(error.stack || error.message)
    });

    this.controlServer.listen(this.controlPort, CONTROL_BIND_HOST, () => {
      this.pushLog(`Control API listening on http://${CONTROL_BIND_HOST}:${this.controlPort}`);
      this.pushLog(`Health probe: http://${CONTROL_BIND_HOST}:${this.controlPort}/health`);
    });
  }

  private proxyRequestContext() {
    return {
      backendHost: BACKEND_HOST,
      backendPort: this.backendPort,
      onLog: (line: string) => this.pushLog(line),
      onDebugLog: (line: string) => this.appendDebugLog(line),
      apiUrl: this.commandCodeApiUrl,
      authPath: this.commandCodeAuthPath,
      env: this.env,
      savedKeys: this.savedCommandCodeApiKeys(),
      rotator: this.commandCodeApiKeyRotator,
      cwd: process.cwd(),
      platform: process.platform
    };
  }

  private dashboardApiContext(): DashboardApiContext {
    return {
      authDir: this.authDir,
      configPath: this.configPath,
      commandCodeAuthPath: this.commandCodeAuthPath,
      commandCodeApiUrl: this.commandCodeApiUrl,
      factorySettingsPath: this.factorySettingsPath,
      managementUrl: this.managementUrl,
      settings: this.settings,
      env: this.env,
      appLogs: this.appLogs,
      commandCodeApiKeyRotator: this.commandCodeApiKeyRotator,
      getSavedCommandCodeApiKeys: () => this.savedCommandCodeApiKeys(),
      saveSettings: () => this.saveSettings(),
      statusPayload: () => this.statusPayload(),
      getAccounts: () => getAccounts(this.authDir),
      factoryModelsStatus: () => this.factoryModelsStatus(),
      saveFactoryModelSelection: (ids) => this.saveFactoryModelSelection(ids),
      applyFactoryCustomModels: () => this.applyFactoryCustomModels(),
      fetchModels: () => this.fetchModels(),
      runLoginDetached: (provider) => this.runLoginDetached(provider),
      openPath: (targetPath) => this.openPath(targetPath),
      writeConfig: () => this.writeConfig(),
      fetchQuotaUsage: () =>
        fetchQuotaUsage({
          managementUrl: this.managementUrl,
          secretKey: this.settings.managementSecretKey
        }),
      resetCodexQuota: (accountName) =>
        resetCodexQuotaUsage({
          managementUrl: this.managementUrl,
          secretKey: this.settings.managementSecretKey,
          accountName
        })
    };
  }

  private statusPayload() {
    const health = this.getHealthPayload();
    return {
      backend: health.backend,
      proxy: {
        running: health.proxy.running,
        url: health.proxy.url,
        bindUrl: `http://${this.frontendHost}:${this.frontendPort}`,
        baseUrl: getProxyBaseUrl(this.frontendHost, this.frontendPort, this.publicHost)
      },
      control: health.control,
      management: {
        url: this.managementUrl,
        secretKey: this.settings.managementSecretKey
      },
      configPath: this.configPath,
      authDir: this.authDir
    };
  }

  private factoryRuntimeContext() {
    return {
      proxyUrl: () => getProxyUrl(this.frontendHost, this.frontendPort, this.publicHost),
      proxyBaseUrl: () => getProxyBaseUrl(this.frontendHost, this.frontendPort, this.publicHost)
    };
  }

  private getDroidProxyModelDefinitions() {
    return buildDroidProxyModelDefinitions(this.factoryRuntimeContext());
  }

  private enabledFactoryModels() {
    return droidProxySettingsModels(this.getDroidProxyModelDefinitions());
  }

  private factoryModelsStatus() {
    return factoryModelsStatusCore({
      definitions: this.getDroidProxyModelDefinitions(),
      settings: this.settings,
      factorySettingsPath: this.factorySettingsPath,
      saveSettings: () => this.saveSettings()
    });
  }

  private applyFactoryCustomModels() {
    return applyFactoryCustomModelsCore({
      definitions: this.getDroidProxyModelDefinitions(),
      settings: this.settings,
      factorySettingsPath: this.factorySettingsPath,
      saveSettings: () => this.saveSettings(),
      onLog: (line) => this.pushLog(line)
    });
  }

  private saveFactoryModelSelection(ids: string[]) {
    saveFactoryModelSelectionCore(
      this.settings,
      ids,
      this.enabledFactoryModels(),
      () => this.saveSettings()
    );
  }

  private async fetchModels() {
    const payload = await requestJSON({
      host: requestHost(this.frontendHost),
      port: this.frontendPort,
      path: "/v1/models",
      timeoutMs: 5000
    }) as { data?: unknown[] };
    return Array.isArray(payload.data) ? payload.data : commandCodeOpenAIModels();
  }

  private runLoginDetached(provider: string) {
    runLoginDetachedCore({
      rootDir: this.rootDir,
      configPath: this.configPath,
      provider: provider as Parameters<typeof runLoginDetachedCore>[0]["provider"],
      resolveBinaryPath: resolveCliBinaryPath,
      writeConfig: () => this.writeConfig(),
      onLog: (line) => this.pushLog(line),
      onBackendLog: (chunk) => this.logBackend(chunk),
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: false,
      wait: false
    });
  }

  private openPath(targetPath: string) {
    fs.mkdirSync(this.authDir, { recursive: true });
    execFile("explorer.exe", [targetPath], { windowsHide: true }, (error) => {
      if (error) this.pushLog(`Failed to open ${targetPath}: ${error.message}`);
    });
  }

  private writeConfig() {
    return writeConfigFile({
      rootDir: this.rootDir,
      managementSecretKey: this.settings.managementSecretKey,
      configPath: this.configPath,
      authDir: this.authDir,
      backendPort: this.backendPort
    });
  }

  private saveSettings() {
    persistSettings(this.settings, {
      settingsPath: this.settingsPath,
      authDir: this.authDir
    });
  }

  private logBackend(chunk: Buffer) {
    const text = chunk.toString().trim();
    if (text) this.pushLog(text);
  }

  private pushLog(line: string) {
    const text = String(line || "").trim();
    if (!text) return;
    const entry = `[${new Date().toLocaleTimeString()}] ${text}`;
    this.appLogs.push(entry);
    this.appLogs = this.appLogs.slice(-500);
    console.log(text);
  }

  private appendDebugLog(line: string) {
    try {
      fs.appendFileSync(this.debugLogPath, `${new Date().toISOString()} ${line}\n`);
    } catch {
      // Debug logging must not break proxying.
    }
  }

  private savedCommandCodeApiKeys() {
    return Array.isArray(this.settings.commandCodeApiKeys) ? this.settings.commandCodeApiKeys : [];
  }
}