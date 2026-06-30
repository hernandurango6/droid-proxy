export interface OpenAICompatibleApiKeyEntry {
  apiKey: string;
  proxyUrl?: string;
  authIndex?: string;
}

export interface OpenAICompatibleModelAlias {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  image?: boolean;
  thinking?: Record<string, unknown>;
}

export interface OpenAICompatibleProvider {
  name: string;
  baseUrl: string;
  apiKeyEntries: OpenAICompatibleApiKeyEntry[];
  prefix?: string;
  disabled?: boolean;
  headers?: Record<string, string>;
  models?: OpenAICompatibleModelAlias[];
  priority?: number;
  testModel?: string;
  disableCooling?: boolean;
}

export function normalizeOpenAICompatibleProviders(value: unknown): OpenAICompatibleProvider[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeOpenAICompatibleProvider)
    .filter((provider): provider is OpenAICompatibleProvider => Boolean(provider));
}

export function renderOpenAICompatibilityYaml(providers: OpenAICompatibleProvider[]): string {
  const normalized = normalizeOpenAICompatibleProviders(providers);
  if (normalized.length === 0) return "";

  const lines = ["openai-compatibility:"];
  for (const provider of normalized) {
    lines.push(`  - name: ${yamlScalar(provider.name)}`);
    lines.push(`    base-url: ${yamlScalar(provider.baseUrl)}`);
    if (provider.prefix) lines.push(`    prefix: ${yamlScalar(provider.prefix)}`);
    if (provider.disabled === true) lines.push("    disabled: true");
    if (provider.disableCooling === true) lines.push("    disable-cooling: true");
    if (typeof provider.priority === "number") lines.push(`    priority: ${provider.priority}`);
    if (provider.testModel) lines.push(`    test-model: ${yamlScalar(provider.testModel)}`);

    lines.push("    api-key-entries:");
    for (const entry of provider.apiKeyEntries) {
      lines.push(`      - api-key: ${yamlScalar(entry.apiKey)}`);
      if (entry.proxyUrl) lines.push(`        proxy-url: ${yamlScalar(entry.proxyUrl)}`);
      if (entry.authIndex) lines.push(`        auth-index: ${yamlScalar(entry.authIndex)}`);
    }

    if (provider.headers && Object.keys(provider.headers).length > 0) {
      lines.push("    headers:");
      for (const [key, headerValue] of Object.entries(provider.headers)) {
        lines.push(`      ${yamlKey(key)}: ${yamlScalar(headerValue)}`);
      }
    }

    if (provider.models && provider.models.length > 0) {
      lines.push("    models:");
      for (const model of provider.models) {
        lines.push(`      - name: ${yamlScalar(model.name)}`);
        if (model.alias) lines.push(`        alias: ${yamlScalar(model.alias)}`);
        if (typeof model.priority === "number") lines.push(`        priority: ${model.priority}`);
        if (model.testModel) lines.push(`        test-model: ${yamlScalar(model.testModel)}`);
        if (model.image === true) lines.push("        image: true");
        if (model.thinking && Object.keys(model.thinking).length > 0) {
          lines.push(`        thinking: ${JSON.stringify(model.thinking)}`);
        }
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function normalizeOpenAICompatibleProvider(value: unknown): OpenAICompatibleProvider | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = stringValue(record.name);
  const baseUrl = stringValue(record.baseUrl ?? record["base-url"]);
  const apiKeyEntries = normalizeApiKeyEntries(record.apiKeyEntries ?? record["api-key-entries"]);
  if (!name || !baseUrl || apiKeyEntries.length === 0) return null;

  const provider: OpenAICompatibleProvider = {
    name,
    baseUrl,
    apiKeyEntries
  };
  const prefix = stringValue(record.prefix);
  if (prefix) provider.prefix = prefix;
  const testModel = stringValue(record.testModel ?? record["test-model"]);
  if (testModel) provider.testModel = testModel;
  const priority = numberValue(record.priority);
  if (priority !== null) provider.priority = priority;
  if (record.disabled === true) provider.disabled = true;
  if (record.disableCooling === true || record["disable-cooling"] === true) provider.disableCooling = true;

  const headers = normalizeHeaders(record.headers);
  if (headers) provider.headers = headers;
  const models = normalizeModels(record.models);
  if (models.length > 0) provider.models = models;
  return provider;
}

function normalizeApiKeyEntries(value: unknown): OpenAICompatibleApiKeyEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === "string") return { apiKey: entry.trim() };
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const apiKey = stringValue(record.apiKey ?? record["api-key"]);
        if (!apiKey) return null;
        const normalized: OpenAICompatibleApiKeyEntry = { apiKey };
        const proxyUrl = stringValue(record.proxyUrl ?? record["proxy-url"]);
        if (proxyUrl) normalized.proxyUrl = proxyUrl;
        const authIndex = stringValue(record.authIndex ?? record["auth-index"]);
        if (authIndex) normalized.authIndex = authIndex;
        return normalized;
      })
      .filter((entry): entry is OpenAICompatibleApiKeyEntry => Boolean(entry));
  }

  const apiKey = stringValue(value);
  return apiKey ? [{ apiKey }] : [];
}

function normalizeModels(value: unknown): OpenAICompatibleModelAlias[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((model) => {
      if (typeof model === "string") return { name: model.trim() };
      if (!model || typeof model !== "object") return null;
      const record = model as Record<string, unknown>;
      const name = stringValue(record.name);
      if (!name) return null;
      const normalized: OpenAICompatibleModelAlias = { name };
      const alias = stringValue(record.alias);
      if (alias) normalized.alias = alias;
      const priority = numberValue(record.priority);
      if (priority !== null) normalized.priority = priority;
      const testModel = stringValue(record.testModel ?? record["test-model"]);
      if (testModel) normalized.testModel = testModel;
      if (record.image === true) normalized.image = true;
      if (record.thinking && typeof record.thinking === "object" && !Array.isArray(record.thinking)) {
        normalized.thinking = record.thinking as Record<string, unknown>;
      }
      return normalized;
    })
    .filter((model): model is OpenAICompatibleModelAlias => Boolean(model));
}

function normalizeHeaders(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    const normalizedKey = key.trim();
    if (!normalizedKey) continue;
    headers[normalizedKey] = String(headerValue ?? "");
  }
  return Object.keys(headers).length > 0 ? headers : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function yamlKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}
