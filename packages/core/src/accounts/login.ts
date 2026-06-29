import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { LOGIN_FLAGS, type LoginProvider } from "../constants/login-flags";

export interface LoginStdioOptions {
  stdio: ["pipe" | "inherit" | "ignore", "pipe" | "inherit" | "ignore", "pipe" | "inherit" | "ignore"];
  windowsHide: boolean;
  wait: boolean;
}

export interface RunLoginOptions extends LoginStdioOptions {
  rootDir: string;
  configPath: string;
  provider: LoginProvider;
  resolveBinaryPath: (rootDir: string) => string;
  writeConfig: () => void;
  onLog: (message: string) => void;
  onBackendLog?: (chunk: Buffer) => void;
  env?: NodeJS.ProcessEnv;
}

export function runLogin(options: RunLoginOptions): Promise<void> {
  options.writeConfig();
  const binary = options.resolveBinaryPath(options.rootDir);
  if (!fs.existsSync(binary)) {
    return Promise.reject(new Error(`Missing cli-proxy-api.exe at ${binary}`));
  }

  const args = ["--config", options.configPath, LOGIN_FLAGS[options.provider]];
  options.onLog(`Starting ${options.provider} OAuth login`);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: path.dirname(binary),
      windowsHide: options.windowsHide,
      env: options.env ?? process.env,
      stdio: options.stdio
    });

    if (child.stdout) child.stdout.on("data", (chunk) => options.onBackendLog?.(chunk));
    if (child.stderr) child.stderr.on("data", (chunk) => options.onBackendLog?.(chunk));

    if (options.provider === "codex") {
      setTimeout(() => {
        if (!child.killed && child.stdin) child.stdin.write("\n");
      }, 12000);
    }

    child.on("error", reject);
    child.on("exit", (code) => {
      options.onLog(`${options.provider} login exited with code ${code}`);
      if (!options.wait || code === 0) resolve();
      else reject(new Error(`${options.provider} login exited with code ${code}`));
    });

    if (!options.wait) {
      resolve();
    }
  });
}

export function runLoginDetached(options: RunLoginOptions): void {
  runLogin(options).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    options.onLog(`Failed to start ${options.provider} login: ${message}`);
  });
}