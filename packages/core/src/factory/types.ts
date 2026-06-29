export interface FactoryRuntimeContext {
  proxyBaseUrl: () => string;
  proxyUrl: () => string;
}

export interface DroidProxyModelDefinition {
  baseModel: string;
  idSlug: string;
  displayName: string;
  maxOutputTokens: number;
  provider: string;
  providerKey: string;
  baseUrl: string;
  kind: string;
  noImageSupport?: boolean;
  reasoning?: boolean;
  levels: string[];
  defaultLevel: string | null;
}

export interface DroidProxyFactoryModel {
  model: string;
  id: string;
  baseUrl: string;
  apiKey: string;
  displayName: string;
  maxOutputTokens: number;
  noImageSupport?: boolean;
  provider: string;
  enableThinking?: boolean;
  supportedReasoningEfforts?: string[];
  defaultReasoningEffort?: string | null;
  reasoningEffort?: string | null;
  index?: number;
}

export interface FactoryModelsStatus {
  installed: boolean;
  expectedCount: number;
  selectedCount: number;
  installedCount: number;
  settingsPath: string;
  selectedIds: string[];
  models: DroidProxyFactoryModel[];
}

export interface ApplyFactoryResult {
  applied: boolean;
  count: number;
  settingsPath: string;
  backupPath: string | null;
}

export interface FactorySettingsFile {
  customModels?: DroidProxyFactoryModel[];
  [key: string]: unknown;
}