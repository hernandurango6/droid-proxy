import fs from "fs";
import path from "path";
import { getCliBinaryPath } from "@droidproxy/core";

function firstExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveCliBinaryPath(rootDir: string): string {
  const resourceDir = process.env.TAURI_RESOURCE_DIR;
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const execDir = path.dirname(process.execPath);

  const resolved = firstExistingPath([
    resourceDir ? path.join(resourceDir, "bin", "cli-proxy-api.exe") : "",
    resourcesPath ? path.join(resourcesPath, "bin", "cli-proxy-api.exe") : "",
    path.join(execDir, "cli-proxy-api.exe"),
    getCliBinaryPath(rootDir)
  ]);

  return resolved ?? getCliBinaryPath(rootDir);
}