import { invoke } from "@tauri-apps/api/core";
import type { ManagementRequest, ManagementResponse } from "@/management/types";
import type {
  Account,
  ConfigPayload,
  FactoryModelsStatus,
  LoginProvider,
  ModelEntry,
  QuotaSettings,
  StatusPayload
} from "./types";

export const droidproxy = {
  lab: {
    status: () => invoke<StatusPayload>("lab_status"),
    config: () => invoke<ConfigPayload>("lab_config"),
    accounts: () => invoke<{ accounts: Account[] }>("lab_accounts"),
    logs: () => invoke<{ logs: string[] }>("lab_logs"),
    models: () => invoke<{ models: ModelEntry[]; error?: string; message?: string }>("lab_models"),
    factoryModels: () => invoke<FactoryModelsStatus>("lab_factory_models"),
    factoryModelsSelection: (ids: string[]) =>
      invoke<FactoryModelsStatus>("lab_factory_models_selection", { ids }),
    commandCodeKeys: (keys: string) =>
      invoke<{ count: number; keys: string[] }>("lab_commandcode_keys", { keys }),
    applyFactoryModels: () =>
      invoke<{ applied: boolean; count: number }>("lab_apply_factory_models"),
    login: (provider: LoginProvider) =>
      invoke<{ started: boolean; provider: string }>("lab_login", { provider }),
    openPath: (target: "auth" | "config") =>
      invoke<{ opened: boolean; path?: string; url?: string }>("lab_open_path", {
        request: { target }
      }),
    quotaSettings: () => invoke<QuotaSettings>("lab_quota_settings"),
    saveQuotaSettings: (settings: QuotaSettings) =>
      invoke<QuotaSettings>("lab_save_quota_settings", { settings })
  },
  supervisor: {
    restart: () => invoke<void>("supervisor_restart")
  },
  management: {
    request: (req: ManagementRequest) => invoke<ManagementResponse>("mgmt_request", { req })
  }
};