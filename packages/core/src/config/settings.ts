import crypto from "crypto";
import fs from "fs";
import { getAuthDir, getSettingsPath } from "../constants/paths";
import { parseCommandCodeApiKeys } from "./commandcode-keys";
import { normalizeOpenAICompatibleProviders, type OpenAICompatibleProvider } from "./openai-compatible";

export interface AppSettings {
  managementSecretKey: string;
  commandCodeApiKeys: string[];
  openAICompatibleProviders?: OpenAICompatibleProvider[];
  factoryModelIds?: string[] | null;
  [key: string]: unknown;
}

export interface SettingsIO {
  readSettingsFile(path: string): unknown;
  writeSettingsFile(path: string, settings: AppSettings): void;
  ensureAuthDir(path: string): void;
}

const defaultIO: SettingsIO = {
  ensureAuthDir(authDir: string) {
    fs.mkdirSync(authDir, { recursive: true });
  },
  readSettingsFile(path: string) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
  },
  writeSettingsFile(path: string, settings: AppSettings) {
    fs.writeFileSync(path, JSON.stringify(settings, null, 2));
  }
};

export function generateSecretKey(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function normalizeLoadedSettings(loaded: unknown): AppSettings | null {
  if (!loaded || typeof loaded !== "object") return null;
  const record = loaded as Record<string, unknown>;
  if (typeof record.managementSecretKey !== "string" || record.managementSecretKey.length < 24) {
    return null;
  }

  const commandCodeApiKeys = Array.isArray(record.commandCodeApiKeys)
    ? parseCommandCodeApiKeys(record.commandCodeApiKeys.join("\n"))
    : [];

  return {
    ...record,
    managementSecretKey: record.managementSecretKey,
    commandCodeApiKeys,
    openAICompatibleProviders: normalizeOpenAICompatibleProviders(record.openAICompatibleProviders),
    factoryModelIds: Array.isArray(record.factoryModelIds) ? record.factoryModelIds : null
  } as AppSettings;
}

export function loadSettings(
  options: { settingsPath?: string; authDir?: string; io?: SettingsIO } = {}
): AppSettings {
  const io = options.io ?? defaultIO;
  const authDir = options.authDir ?? getAuthDir();
  const settingsPath = options.settingsPath ?? getSettingsPath();

  io.ensureAuthDir(authDir);

  try {
    const normalized = normalizeLoadedSettings(io.readSettingsFile(settingsPath));
    if (normalized) return normalized;
  } catch {
    // Missing or invalid settings are regenerated below.
  }

  const generated: AppSettings = {
    managementSecretKey: generateSecretKey(),
    commandCodeApiKeys: []
  };
  io.writeSettingsFile(settingsPath, generated);
  return generated;
}

export function saveSettings(
  settings: AppSettings,
  options: { settingsPath?: string; authDir?: string; io?: SettingsIO } = {}
): void {
  const io = options.io ?? defaultIO;
  const authDir = options.authDir ?? getAuthDir();
  const settingsPath = options.settingsPath ?? getSettingsPath();
  io.ensureAuthDir(authDir);
  io.writeSettingsFile(settingsPath, settings);
}
