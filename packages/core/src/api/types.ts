import type { CommandCodeApiKeyRotator } from "../commandcode/api-keys";
import type { AppSettings } from "../config/settings";
import type { Account } from "../accounts/types";
import type { ApplyFactoryResult, FactoryModelsStatus } from "../factory/types";

export interface DashboardApiContext {
  authDir: string;
  configPath: string;
  commandCodeAuthPath: string;
  commandCodeApiUrl: string;
  factorySettingsPath: string;
  managementUrl: string;
  settings: AppSettings;
  env: NodeJS.ProcessEnv;
  appLogs: string[];
  commandCodeApiKeyRotator: CommandCodeApiKeyRotator;
  getSavedCommandCodeApiKeys: () => string[];
  saveSettings: () => void;
  statusPayload: () => Record<string, unknown>;
  getAccounts: () => Account[];
  factoryModelsStatus: () => FactoryModelsStatus | Promise<FactoryModelsStatus>;
  saveFactoryModelSelection: (ids: string[]) => void | Promise<void>;
  applyFactoryCustomModels: () => ApplyFactoryResult | Promise<ApplyFactoryResult>;
  fetchModels: () => Promise<unknown[]>;
  runLoginDetached: (provider: string) => void;
  openPath: (targetPath: string) => void;
  writeConfig: () => void;
  fetchQuotaUsage: () => Promise<unknown>;
  resetCodexQuota: (accountName: string) => Promise<unknown>;
}
