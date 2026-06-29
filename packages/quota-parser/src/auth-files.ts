export interface AuthFileItem {
  name: string;
  type?: string;
  provider?: string;
  disabled?: boolean;
  auth_index?: string;
  authIndex?: string;
  project_id?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

export function resolveAuthProvider(file: AuthFileItem): string {
  const raw = file.provider ?? file.type ?? "";
  const key = String(raw).trim().toLowerCase().replace(/_/g, "-");
  if (key === "x-ai" || key === "grok") return "xai";
  return key;
}

export function isAntigravityFile(file: AuthFileItem): boolean {
  return resolveAuthProvider(file) === "antigravity";
}

export function isClaudeFile(file: AuthFileItem): boolean {
  return resolveAuthProvider(file) === "claude";
}

export function isCodexFile(file: AuthFileItem): boolean {
  return resolveAuthProvider(file) === "codex";
}

export function isKimiFile(file: AuthFileItem): boolean {
  return resolveAuthProvider(file) === "kimi";
}

export function isXaiFile(file: AuthFileItem): boolean {
  return resolveAuthProvider(file) === "xai";
}

export function isDisabledAuthFile(file: AuthFileItem): boolean {
  const raw = (file as { disabled?: unknown }).disabled;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
  return false;
}

export function normalizeAuthIndex(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return null;
}