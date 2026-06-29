import { normalizeStringValue, parseJsonPayload } from "../normalize";
import type { QuotaWindowSummary } from "../types";
import { isKimiFile, type AuthFileItem } from "../auth-files";

interface KimiUsagePayload {
  usage?: Record<string, unknown>;
  limits?: Array<Record<string, unknown>>;
}

function toInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }
  return null;
}

function kimiDurationToken(duration: number, rawTimeUnit: unknown): string {
  const unit = typeof rawTimeUnit === "string" ? rawTimeUnit.trim().toUpperCase() : "";
  if (unit === "SECONDS" || unit === "SECOND") return `${duration}s`;
  if (!unit || unit === "MINUTES" || unit === "MINUTE") {
    return duration % 60 === 0 ? `${duration / 60}h` : `${duration}m`;
  }
  if (unit === "HOURS" || unit === "HOUR") return `${duration}h`;
  if (unit === "DAYS" || unit === "DAY") return `${duration}d`;
  return duration % 60 === 0 ? `${duration / 60}h` : `${duration}m`;
}

function kimiLimitLabel(
  item: Record<string, unknown>,
  detail: Record<string, unknown>,
  window: Record<string, unknown>,
  index: number
): string {
  for (const key of ["name", "title", "scope"] as const) {
    const val = item[key] ?? detail[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }

  const duration =
    toInt(window.duration) ?? toInt(item.duration) ?? toInt(detail.duration);
  const timeUnit = window.timeUnit ?? item.timeUnit ?? detail.timeUnit;

  if (duration !== null && duration > 0) {
    return `${kimiDurationToken(duration, timeUnit)} window`;
  }

  return `Limit ${index + 1}`;
}

function toKimiUsageRow(
  data: Record<string, unknown>,
  fallbackLabel: string
): { id: string; label: string; usedPercent: number | null } | null {
  const limit = toInt(data.limit);
  let used = toInt(data.used);
  if (used === null) {
    const remaining = toInt(data.remaining);
    if (remaining !== null && limit !== null) {
      used = limit - remaining;
    }
  }
  if (used === null && limit === null) return null;

  const explicitLabel =
    (typeof data.name === "string" && data.name.trim()) ||
    (typeof data.title === "string" && data.title.trim());
  const label = explicitLabel || fallbackLabel;
  const usedValue = used ?? 0;
  const limitValue = limit ?? 0;
  const usedPercent =
    limitValue > 0 ? Math.round((usedValue / limitValue) * 10000) / 100 : usedValue > 0 ? 100 : null;

  return {
    id: toStableId(label, "kimi-row"),
    label,
    usedPercent
  };
}

function toStableId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

export function parseKimiUsagePayload(payload: unknown): KimiUsagePayload | null {
  return parseJsonPayload<KimiUsagePayload>(payload);
}

export function buildKimiQuotaWindows(payload: KimiUsagePayload): QuotaWindowSummary[] {
  const windows: QuotaWindowSummary[] = [];

  const usage = payload.usage;
  if (usage && typeof usage === "object") {
    const summary = toKimiUsageRow(usage, "Weekly limit");
    if (summary) {
      windows.push({
        id: "summary",
        label: summary.label,
        usedPercent: summary.usedPercent,
        resetLabel: "-"
      });
    }
  }

  const limits = payload.limits;
  if (Array.isArray(limits)) {
    limits.forEach((item, idx) => {
      const detail = (
        item.detail && typeof item.detail === "object" ? item.detail : item
      ) as Record<string, unknown>;
      const window = (
        item.window && typeof item.window === "object" ? item.window : {}
      ) as Record<string, unknown>;
      const fallbackLabel = kimiLimitLabel(item, detail, window, idx);
      const row = toKimiUsageRow(detail, fallbackLabel);
      if (row) {
        windows.push({
          id: `limit-${idx}`,
          label: row.label,
          usedPercent: row.usedPercent,
          resetLabel: "-"
        });
      }
    });
  }

  return windows;
}

export function parseKimiQuotaSummary(payload: unknown): { provider: "kimi"; windows: QuotaWindowSummary[] } | null {
  const parsed = parseKimiUsagePayload(payload);
  if (!parsed) return null;
  const windows = buildKimiQuotaWindows(parsed);
  if (windows.length === 0) return null;
  return { provider: "kimi", windows };
}

export { isKimiFile };