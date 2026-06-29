import fs from "node:fs";
import path from "node:path";
import type { AppSettings } from "../config/settings";
import { backupFactorySettingsIfPresent, readFactorySettings } from "./factory-settings";
import { isDroidProxyModelId, setEquals } from "./helpers";
import { getFactoryModelSelection } from "./selection";
import { droidProxySettingsModels } from "./settings-models";
import type {
  ApplyFactoryResult,
  DroidProxyModelDefinition,
  FactoryModelsStatus,
  FactorySettingsFile
} from "./types";

export function factoryModelsStatus({
  definitions,
  settings,
  factorySettingsPath,
  saveSettings
}: {
  definitions: DroidProxyModelDefinition[];
  settings: AppSettings;
  factorySettingsPath: string;
  saveSettings: () => void;
}): FactoryModelsStatus {
  const enabledModels = droidProxySettingsModels(definitions);
  const selectedIds = getFactoryModelSelection(settings, enabledModels, saveSettings);
  const expectedIds = new Set(enabledModels.map((model) => model.id));
  const selectedExpectedIds = new Set(
    enabledModels.filter((model) => selectedIds.includes(model.id)).map((model) => model.id)
  );
  const factorySettings = readFactorySettings(factorySettingsPath);
  const models = Array.isArray(factorySettings.customModels) ? factorySettings.customModels : [];
  const installedIds = new Set(models
    .map((model) => model && model.id)
    .filter((id): id is string => typeof id === "string")
    .filter(isDroidProxyModelId));

  return {
    installed: selectedExpectedIds.size > 0 && setEquals(installedIds, selectedExpectedIds),
    expectedCount: expectedIds.size,
    selectedCount: selectedExpectedIds.size,
    installedCount: installedIds.size,
    settingsPath: factorySettingsPath,
    selectedIds,
    models: enabledModels
  };
}

export function applyFactoryCustomModels({
  definitions,
  settings,
  factorySettingsPath,
  saveSettings,
  onLog
}: {
  definitions: DroidProxyModelDefinition[];
  settings: AppSettings;
  factorySettingsPath: string;
  saveSettings: () => void;
  onLog?: (message: string) => void;
}): ApplyFactoryResult {
  fs.mkdirSync(path.dirname(factorySettingsPath), { recursive: true });

  const factorySettings: FactorySettingsFile = readFactorySettings(factorySettingsPath);
  const existingModels = Array.isArray(factorySettings.customModels) ? factorySettings.customModels : [];
  const retainedModels = existingModels.filter((model) => {
    const id = model && model.id;
    return typeof id !== "string" || !isDroidProxyModelId(id);
  });

  const startIndex = retainedModels.length;
  const enabledModels = droidProxySettingsModels(definitions);
  const selectedIds = getFactoryModelSelection(settings, enabledModels, saveSettings);
  const nextModels = enabledModels
    .filter((model) => selectedIds.includes(model.id))
    .map((model, offset) => ({
      ...model,
      index: startIndex + offset
    }));

  factorySettings.customModels = retainedModels.concat(nextModels);
  const backupPath = backupFactorySettingsIfPresent(factorySettingsPath);
  fs.writeFileSync(
    factorySettingsPath,
    `${JSON.stringify(factorySettings, null, 2).replaceAll("\\/", "/")}\n`
  );

  onLog?.(`Applied ${nextModels.length} DroidProxy custom models to ${factorySettingsPath}`);
  if (backupPath) onLog?.(`Backed up Factory settings to ${backupPath}`);

  return {
    applied: true,
    count: nextModels.length,
    settingsPath: factorySettingsPath,
    backupPath
  };
}