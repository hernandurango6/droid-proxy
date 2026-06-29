import type { DroidProxyFactoryModel, DroidProxyModelDefinition } from "./types";

export function droidProxySettingsModels(definitions: DroidProxyModelDefinition[]): DroidProxyFactoryModel[] {
  return definitions.map((definition) => {
    const entry: DroidProxyFactoryModel = {
      model: definition.baseModel,
      id: `custom:droidproxy:${definition.idSlug}`,
      baseUrl: definition.baseUrl,
      apiKey: "dummy-not-used",
      displayName: `DroidProxy: ${definition.kind === "antigravity" ? `Antigravity: ${definition.displayName}` : definition.displayName}`,
      maxOutputTokens: definition.maxOutputTokens,
      noImageSupport: Boolean(definition.noImageSupport),
      provider: definition.provider
    };

    if (definition.levels.length > 0) {
      entry.enableThinking = true;
      entry.supportedReasoningEfforts = definition.levels;
      entry.defaultReasoningEffort = definition.defaultLevel;
      entry.reasoningEffort = definition.levels.length === 1
        ? definition.levels[0]
        : definition.defaultLevel;
    } else if (definition.reasoning) {
      entry.enableThinking = true;
    }

    return entry;
  });
}