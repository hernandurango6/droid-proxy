import fs from "fs";
import os from "os";
import path from "path";

export const AUTH_DIR_NAME = ".cli-proxy-api";
export const CONFIG_FILE_NAME = "droidproxy-commandcode-lab-config.yaml";
export const SETTINGS_FILE_NAME = "droidproxy-commandcode-lab-settings.json";
export const COMMANDCODE_AUTH_DIR_NAME = ".commandcode";
export const COMMANDCODE_AUTH_FILE_NAME = "auth.json";
export const FACTORY_SETTINGS_DIR_NAME = ".factory";
export const FACTORY_SETTINGS_FILE_NAME = "settings.json";
export const DEBUG_LOG_FILE_NAME = "droidproxy-debug.log";

/** Matches `path.resolve(__dirname, "..")` when `fromDirname` is the `src/` folder (e.g. `src/cli.js`). */
export function resolveRepoRootFromSrcDir(srcDirname: string): string {
  return path.resolve(srcDirname, "..");
}

export function getAuthDir(): string {
  return path.join(os.homedir(), AUTH_DIR_NAME);
}

export function getConfigPath(): string {
  return path.join(getAuthDir(), CONFIG_FILE_NAME);
}

export function getSettingsPath(): string {
  return path.join(getAuthDir(), SETTINGS_FILE_NAME);
}

export function getDebugLogPath(): string {
  return path.join(os.tmpdir(), DEBUG_LOG_FILE_NAME);
}

export function getFactorySettingsPath(): string {
  return path.join(os.homedir(), FACTORY_SETTINGS_DIR_NAME, FACTORY_SETTINGS_FILE_NAME);
}

export function getCommandCodeAuthPath(): string {
  return path.join(os.homedir(), COMMANDCODE_AUTH_DIR_NAME, COMMANDCODE_AUTH_FILE_NAME);
}

export function getDashboardDir(rootDir: string): string {
  return path.join(rootDir, "dashboard");
}

export function getResourcesDir(rootDir: string): string {
  return path.join(rootDir, "resources");
}

export function getCliBinaryPath(rootDir: string): string {
  return path.join(getResourcesDir(rootDir), "bin", "cli-proxy-api.exe");
}

function hasConfigTemplate(dir: string): boolean {
  return fs.existsSync(path.join(dir, "config.template.yaml"));
}

/** Resolves the directory containing config.template.yaml (repo or Tauri bundle layout). */
export function resolveResourcesDir(rootDir: string, env: NodeJS.ProcessEnv = process.env): string {
  const tauriDir = env.TAURI_RESOURCE_DIR;
  if (tauriDir) {
    if (hasConfigTemplate(tauriDir)) {
      return tauriDir;
    }
    const nestedResources = path.join(tauriDir, "resources");
    if (hasConfigTemplate(nestedResources)) {
      return nestedResources;
    }
    const parent = path.dirname(tauriDir);
    if (hasConfigTemplate(parent)) {
      return parent;
    }
    return tauriDir;
  }
  if (hasConfigTemplate(rootDir)) {
    return rootDir;
  }
  const nestedResources = getResourcesDir(rootDir);
  if (hasConfigTemplate(nestedResources)) {
    return nestedResources;
  }
  return nestedResources;
}