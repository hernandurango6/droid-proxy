export type LoginProvider = "claude" | "codex" | "gemini" | "antigravity" | "kimi" | "xai";

export interface StatusPayload {
  backend: { running: boolean; pid: number | null; url: string };
  proxy: {
    running: boolean;
    url: string;
    baseUrl?: string;
    bindUrl?: string;
  };
  control?: { running: boolean; url: string };
  dashboard?: { running: boolean; url: string };
  management: { url: string; keyConfigured?: boolean; secretKey?: string };
}

export interface ConfigPayload {
  configPath: string;
  authDir: string;
  commandCodeAuthPath: string;
  commandCodeAuth: boolean;
  commandCodeApiKeyCount: number;
  configuredCommandCodeApiKeys: Array<{ key: string; source: string }>;
  savedCommandCodeApiKeyCount: number;
  savedCommandCodeApiKeys: string[];
  commandCodeUrl: string;
  factorySettingsPath: string;
  managementUrl: string;
  managementKeyMasked?: string;
  managementKeyConfigured?: boolean;
  managementSecretKey?: string;
  debug: boolean;
  gpt54FastMode: boolean;
  gpt55FastMode: boolean;
  requestRetry: string;
  requestTimeout: string;
}

export interface Account {
  file: string;
  type: string;
  email: string;
  disabled: boolean;
}

export interface ModelEntry {
  id: string;
  object?: string;
  owned_by?: string;
}

export interface FactoryModel {
  id: string;
  displayName: string;
  model: string;
  provider: string;
}

export interface QuotaAlertThresholds {
  warn: number;
  critical: number;
}

export interface QuotaSettings {
  quotaPollIntervalSec: number;
  quotaAlertThresholds: QuotaAlertThresholds;
  quotaNotificationsEnabled: boolean;
}

export interface DesktopSettings extends QuotaSettings {
  autoStart: boolean;
  minimizeToTray: boolean;
  allowLanAccess: boolean;
  autoStartRegistered?: boolean;
}

export interface FactoryModelsStatus {
  installed: boolean;
  expectedCount: number;
  selectedCount: number;
  installedCount: number;
  settingsPath: string;
  selectedIds: string[];
  models: FactoryModel[];
}