import { CLAUDE_USAGE_WINDOW_KEYS } from "../constants";
import { normalizeNumberValue, parseJsonPayload } from "../normalize";
import type { QuotaWindowSummary } from "../types";
import { isClaudeFile, type AuthFileItem } from "../auth-files";

export interface ClaudeUsagePayload {
  [key: string]: unknown;
}

export function parseClaudeUsagePayload(payload: unknown): ClaudeUsagePayload | null {
  return parseJsonPayload<ClaudeUsagePayload>(payload);
}

export function buildClaudeQuotaWindows(payload: ClaudeUsagePayload): QuotaWindowSummary[] {
  const windows: QuotaWindowSummary[] = [];

  for (const { key, id, label } of CLAUDE_USAGE_WINDOW_KEYS) {
    const window = payload[key];
    if (!window || typeof window !== "object" || !("utilization" in window)) continue;
    const typedWindow = window as { utilization: unknown; resets_at?: string };
    const usedPercent = normalizeNumberValue(typedWindow.utilization);
    windows.push({
      id,
      label,
      usedPercent,
      resetLabel: typedWindow.resets_at ?? "-"
    });
  }

  return windows;
}

export function parseClaudeQuotaSummary(payload: unknown): { provider: "claude"; windows: QuotaWindowSummary[] } | null {
  const parsed = parseClaudeUsagePayload(payload);
  if (!parsed) return null;
  const windows = buildClaudeQuotaWindows(parsed);
  if (windows.length === 0) return null;
  return { provider: "claude", windows };
}

export { isClaudeFile };