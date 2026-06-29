export function parseCommandCodeApiKeys(value: unknown): string[] {
  const keys: string[] = [];
  addCommandCodeApiKeys(keys, value);
  return [...new Set(keys)];
}

export function addCommandCodeApiKeys(keys: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const trimmed = value.trim();
  if (!trimmed) return;

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        for (const item of parsed) addCommandCodeApiKeys(keys, item);
        return;
      }
    } catch {
      // Fall back to delimiter parsing below.
    }
  }

  for (const apiKey of trimmed.split(/[\r\n,;]+/)) {
    const normalized = apiKey.trim();
    if (normalized) keys.push(normalized);
  }
}

export function maskApiKey(apiKey: unknown): string {
  const value = String(apiKey || "");
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}