import { COMMANDCODE_MODELS } from "../constants/commandcode-models";
import { commandCodeSlug } from "../commandcode/models";
import type { DroidProxyModelDefinition, FactoryRuntimeContext } from "./types";

export function buildDroidProxyModelDefinitions(ctx: FactoryRuntimeContext): DroidProxyModelDefinition[] {
  const low = "low";
  const medium = "medium";
  const high = "high";
  const xhigh = "xhigh";
  const max = "max";
  const claudeAdvancedLevels = [low, medium, high, xhigh, max];
  const claudeSonnetLevels = [low, medium, high, max];
  const codexLevels = [low, medium, high, xhigh];
  const xaiLevels = [low, medium, high];
  const proxyBaseUrl = ctx.proxyBaseUrl();
  const proxyUrl = ctx.proxyUrl();

  const antigravityModel = ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens = 65536,
    levels = [high],
    defaultLevel = high
  }: {
    baseModel: string;
    idSlug: string;
    displayName: string;
    maxOutputTokens?: number;
    levels?: string[];
    defaultLevel?: string;
  }): DroidProxyModelDefinition => ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens,
    provider: "openai",
    providerKey: "antigravity",
    baseUrl: proxyBaseUrl,
    kind: "antigravity",
    levels,
    defaultLevel
  });

  const xaiModel = ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens = 131072,
    levels = xaiLevels,
    defaultLevel = high
  }: {
    baseModel: string;
    idSlug: string;
    displayName: string;
    maxOutputTokens?: number;
    levels?: string[];
    defaultLevel?: string;
  }): DroidProxyModelDefinition => ({
    baseModel,
    idSlug,
    displayName,
    maxOutputTokens,
    provider: "openai",
    providerKey: "xai",
    baseUrl: proxyBaseUrl,
    kind: "xai",
    levels,
    defaultLevel
  });

  const commandCodeModel = ({
    id,
    name,
    maxOutputTokens = 64000,
    levels = [] as string[],
    defaultLevel = null as string | null,
    vision = false,
    reasoning = false,
    droidModel = null as string | null
  }: {
    id: string;
    name: string;
    maxOutputTokens?: number;
    levels?: string[];
    defaultLevel?: string | null;
    vision?: boolean;
    reasoning?: boolean;
    droidModel?: string | null;
  }): DroidProxyModelDefinition => {
    const effectiveLevels = levels.length > 0 ? levels : (reasoning ? [high] : []);
    const effectiveDefaultLevel = defaultLevel || effectiveLevels[0] || null;
    const isAnthropic = String(id).startsWith("claude-");

    return {
      baseModel: `commandcode:${droidModel || id}`,
      idSlug: `commandcode-${commandCodeSlug(id)}`,
      displayName: `CommandCode: ${name}`,
      maxOutputTokens,
      provider: isAnthropic ? "anthropic" : "generic-chat-completion-api",
      providerKey: "commandcode",
      baseUrl: isAnthropic ? proxyUrl : proxyBaseUrl,
      kind: "commandcode",
      noImageSupport: !vision,
      reasoning,
      levels: effectiveLevels,
      defaultLevel: effectiveDefaultLevel
    };
  };

  return [
    ...COMMANDCODE_MODELS.map(commandCodeModel),
    {
      baseModel: "claude-fable-5",
      idSlug: "fable-5",
      displayName: "Fable 5",
      maxOutputTokens: 128000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl,
      kind: "claudeAdaptive",
      levels: claudeAdvancedLevels,
      defaultLevel: xhigh
    },
    {
      baseModel: "claude-opus-4-8",
      idSlug: "opus-4-8",
      displayName: "Opus 4.8",
      maxOutputTokens: 128000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl,
      kind: "claudeAdaptive",
      levels: claudeAdvancedLevels,
      defaultLevel: xhigh
    },
    {
      baseModel: "claude-sonnet-4-6",
      idSlug: "sonnet-4-6",
      displayName: "Sonnet 4.6",
      maxOutputTokens: 64000,
      provider: "anthropic",
      providerKey: "claude",
      baseUrl: proxyUrl,
      kind: "claudeAdaptive",
      levels: claudeSonnetLevels,
      defaultLevel: high
    },
    {
      baseModel: "gpt-5.4",
      idSlug: "gpt-5.4",
      displayName: "GPT 5.4",
      maxOutputTokens: 128000,
      provider: "openai",
      providerKey: "codex",
      baseUrl: proxyBaseUrl,
      kind: "codex",
      levels: codexLevels,
      defaultLevel: high
    },
    {
      baseModel: "gpt-5.5",
      idSlug: "gpt-5.5",
      displayName: "GPT 5.5",
      maxOutputTokens: 128000,
      provider: "openai",
      providerKey: "codex",
      baseUrl: proxyBaseUrl,
      kind: "codex",
      levels: codexLevels,
      defaultLevel: high
    },
    antigravityModel({
      baseModel: "gemini-pro-agent",
      idSlug: "antigravity-gemini-3.1-pro",
      displayName: "Gemini 3.1 Pro (High)"
    }),
    antigravityModel({
      baseModel: "gemini-3.1-pro-low",
      idSlug: "gemini-3.1-pro-low",
      displayName: "Gemini 3.1 Pro (Low)",
      levels: [low],
      defaultLevel: low
    }),
    antigravityModel({
      baseModel: "gemini-3-flash",
      idSlug: "antigravity-gemini-3-flash",
      displayName: "Gemini 3 Flash"
    }),
    antigravityModel({
      baseModel: "gemini-3-flash-agent",
      idSlug: "gemini-3.5-flash",
      displayName: "Gemini 3.5 Flash",
      levels: [medium, high],
      defaultLevel: high
    }),
    antigravityModel({
      baseModel: "gemini-3.5-flash-low",
      idSlug: "gemini-3.5-flash-low",
      displayName: "Gemini 3.5 Flash (Low)",
      levels: [low],
      defaultLevel: low
    }),
    antigravityModel({
      baseModel: "gemini-3.1-flash-lite",
      idSlug: "gemini-3.1-flash-lite",
      displayName: "Gemini 3.1 Flash Lite"
    }),
    antigravityModel({
      baseModel: "ag-c46s-thinking",
      idSlug: "ag-c46s-thinking",
      displayName: "Claude Sonnet 4.6 (Thinking)",
      maxOutputTokens: 64000
    }),
    antigravityModel({
      baseModel: "ag-c46o-thinking",
      idSlug: "ag-c46o-thinking",
      displayName: "Claude Opus 4.6 (Thinking)",
      maxOutputTokens: 64000
    }),
    antigravityModel({
      baseModel: "gpt-oss-120b-medium",
      idSlug: "gpt-oss-120b-medium",
      displayName: "GPT-OSS 120B (Medium)",
      maxOutputTokens: 32768,
      levels: [medium],
      defaultLevel: medium
    }),
    {
      baseModel: "kimi-k2.6",
      idSlug: "kimi-k2.6",
      displayName: "Kimi K2.6",
      maxOutputTokens: 262144,
      provider: "openai",
      providerKey: "kimi",
      baseUrl: proxyBaseUrl,
      kind: "kimi",
      levels: [high],
      defaultLevel: high
    },
    xaiModel({
      baseModel: "grok-4.20-0309-reasoning",
      idSlug: "grok-4.20-0309-reasoning",
      displayName: "Grok 4.20 Reasoning"
    }),
    xaiModel({
      baseModel: "grok-4.20-0309-non-reasoning",
      idSlug: "grok-4.20-0309-non-reasoning",
      displayName: "Grok 4.20 Non-Reasoning",
      levels: [high]
    }),
    xaiModel({
      baseModel: "grok-4.20-multi-agent-0309",
      idSlug: "grok-4.20-multi-agent-0309",
      displayName: "Grok 4.20 Multi-Agent"
    }),
    xaiModel({
      baseModel: "grok-4.3",
      idSlug: "grok-4.3",
      displayName: "Grok 4.3"
    }),
    xaiModel({
      baseModel: "grok-build-0.1",
      idSlug: "grok-build-0.1",
      displayName: "Grok Build 0.1"
    }),
    xaiModel({
      baseModel: "grok-composer-2.5-fast",
      idSlug: "grok-composer-2.5-fast",
      displayName: "Grok Composer 2.5 Fast"
    }),
    xaiModel({
      baseModel: "grok-3-mini",
      idSlug: "grok-3-mini",
      displayName: "Grok 3 Mini"
    }),
    xaiModel({
      baseModel: "grok-3-mini-fast",
      idSlug: "grok-3-mini-fast",
      displayName: "Grok 3 Mini Fast"
    })
  ];
}