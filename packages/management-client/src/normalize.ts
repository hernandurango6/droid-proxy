const MANAGEMENT_API_SUFFIX = "/v0/management";

export function normalizeManagementBaseUrl(baseUrl: string): string {
  const trimmed = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return `http://127.0.0.1:8418${MANAGEMENT_API_SUFFIX}`;
  }

  if (trimmed.endsWith(MANAGEMENT_API_SUFFIX)) {
    return trimmed;
  }

  if (trimmed.endsWith("/management.html")) {
    return trimmed.replace(/\/management\.html$/, MANAGEMENT_API_SUFFIX);
  }

  return `${trimmed}${MANAGEMENT_API_SUFFIX}`;
}

export function normalizeManagementPath(path: string): string {
  const trimmed = String(path || "").trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function parseResponseBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}