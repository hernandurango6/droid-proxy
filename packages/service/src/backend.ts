import { spawn, execFile, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { envFlag } from "@droidproxy/core";
import { resolveCliBinaryPath } from "./paths";

export interface BackendSpawnOptions {
  rootDir: string;
  configPath: string;
  backendHost: string;
  backendPort: number;
  env?: NodeJS.ProcessEnv;
  onLog?: (line: string) => void;
}

export interface BackendHandle {
  process: ChildProcess;
  pid: number | undefined;
}

export function startBackendProcess(options: BackendSpawnOptions): BackendHandle {
  const binary = resolveCliBinaryPath(options.rootDir);
  if (!fs.existsSync(binary)) {
    throw new Error(`Missing cli-proxy-api.exe at ${binary}`);
  }

  const child = spawn(binary, ["--config", options.configPath], {
    cwd: path.dirname(binary),
    windowsHide: true,
    env: options.env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const onLog = options.onLog ?? (() => {});
  const logChunk = (chunk: Buffer | string) => {
    const text = chunk.toString().trim();
    if (text) onLog(text);
  };

  child.stdout?.on("data", logChunk);
  child.stderr?.on("data", logChunk);

  onLog(`CLIProxyAPI listening on http://${options.backendHost}:${options.backendPort} (pid ${child.pid})`);

  return { process: child, pid: child.pid };
}

export function stopBackendProcess(handle: ChildProcess | null | undefined): void {
  if (handle && !handle.killed) {
    handle.kill();
  }
}

export interface KillOrphanedBackendOptions {
  enabled?: boolean;
  onLog?: (line: string) => void;
}

export function killOrphanedBackend(
  options: KillOrphanedBackendOptions = {}
): Promise<void> {
  const enabled = options.enabled ?? envFlag("DROIDPROXY_KILL_ORPHANED_BACKEND");
  const onLog = options.onLog ?? (() => {});

  if (!enabled) {
    onLog("Skipping global cli-proxy-api.exe cleanup in lab mode");
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    execFile("taskkill.exe", ["/IM", "cli-proxy-api.exe", "/F"], { windowsHide: true }, () => resolve());
  });
}