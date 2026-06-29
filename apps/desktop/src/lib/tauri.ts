import { invoke } from "@tauri-apps/api/core";
import type {
  Account,
  ConfigPayload,
  FactoryModelsStatus,
  LoginProvider,
  ModelEntry,
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
    openPath: (target: "auth" | "config" | "management") =>
      invoke<{ opened: boolean; path?: string; url?: string }>("lab_open_path", {
        request: { target }
      })
  },
  supervisor: {
    restart: () => invoke<void>("supervisor_restart")
  },
  management: {
    openWebview: () => invoke<void>("open_management_webview")
  }
};