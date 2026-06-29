import fs from "node:fs";
import path from "node:path";
import type { FactorySettingsFile } from "./types";

export function readFactorySettings(factorySettingsPath: string): FactorySettingsFile {
  try {
    return JSON.parse(fs.readFileSync(factorySettingsPath, "utf8")) as FactorySettingsFile;
  } catch {
    return {};
  }
}

export function backupFactorySettingsIfPresent(factorySettingsPath: string): string | null {
  if (!fs.existsSync(factorySettingsPath)) return null;

  const timestamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replace("T", "-")
    .replaceAll(":", "")
    .replace(/\..*$/, "");
  const backupPath = path.join(
    path.dirname(factorySettingsPath),
    `settings.json.droidproxy-${timestamp}.bak`
  );
  fs.copyFileSync(factorySettingsPath, backupPath);
  return backupPath;
}