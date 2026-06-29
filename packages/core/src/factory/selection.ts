import type { AppSettings } from "../config/settings";
import type { DroidProxyFactoryModel } from "./types";

export function getFactoryModelSelection(
  settings: AppSettings,
  enabledModels: DroidProxyFactoryModel[],
  saveSettings: () => void
): string[] {
  const allIds = enabledModels.map((model) => model.id);
  if (!Array.isArray(settings.factoryModelIds)) {
    settings.factoryModelIds = [...allIds];
    saveSettings();
    return settings.factoryModelIds;
  }

  const valid = settings.factoryModelIds.filter((id) => allIds.includes(id));
  if (valid.length !== settings.factoryModelIds.length) {
    settings.factoryModelIds = valid;
    saveSettings();
  }

  return settings.factoryModelIds;
}

export function saveFactoryModelSelection(
  settings: AppSettings,
  ids: string[],
  enabledModels: DroidProxyFactoryModel[],
  saveSettings: () => void
): void {
  const allIds = new Set(enabledModels.map((model) => model.id));
  settings.factoryModelIds = [...new Set(ids.filter((id) => allIds.has(id)))];
  saveSettings();
}