import { formatQuotaResetTime } from "../formatters";
import { normalizeQuotaFraction, normalizeStringValue, parseJsonPayload } from "../normalize";
import type { QuotaWindowSummary } from "../types";
import { isAntigravityFile, type AuthFileItem } from "../auth-files";

const BUCKET_WINDOW_ORDER = new Map<string, number>([
  ["5h", 0],
  ["five-hour", 0],
  ["five_hour", 0],
  ["weekly", 1],
  ["week", 1]
]);

interface AntigravityBucket {
  bucketId?: string;
  bucket_id?: string;
  displayName?: string;
  display_name?: string;
  window?: string;
  remainingFraction?: number;
  remaining_fraction?: number;
  resetTime?: string;
  reset_time?: string;
  description?: string;
}

interface AntigravityGroup {
  displayName?: string;
  display_name?: string;
  description?: string;
  buckets?: AntigravityBucket[];
}

interface AntigravityPayload {
  groups?: AntigravityGroup[];
  models?: unknown;
  body?: unknown;
}

function toStableId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function getWindowOrder(bucket: AntigravityBucket): number {
  const window = bucket.window?.toLowerCase();
  if (!window) return Number.MAX_SAFE_INTEGER;
  return BUCKET_WINDOW_ORDER.get(window) ?? Number.MAX_SAFE_INTEGER;
}

export function parseAntigravityPayload(payload: unknown): AntigravityPayload | null {
  const parsed = parseJsonPayload<AntigravityPayload>(payload);
  if (!parsed) return null;
  if ("groups" in parsed) return parsed;
  const nested = parseJsonPayload<AntigravityPayload>(parsed.body);
  return nested ?? parsed;
}

export function buildAntigravityQuotaWindows(payload: AntigravityPayload): QuotaWindowSummary[] {
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const windows: QuotaWindowSummary[] = [];
  const seenIds = new Set<string>();

  groups.forEach((group, groupIndex) => {
    const groupLabel =
      normalizeStringValue(group.displayName ?? group.display_name) ??
      `Quota Group ${groupIndex + 1}`;
    const groupId = toStableId(groupLabel, `quota-group-${groupIndex + 1}`);
    const buckets = Array.isArray(group.buckets) ? group.buckets : [];

    buckets
      .map((bucket, bucketIndex) => {
        const remainingFraction = normalizeQuotaFraction(
          bucket.remainingFraction ?? bucket.remaining_fraction
        );
        if (remainingFraction === null) return null;

        const window = normalizeStringValue(bucket.window) ?? undefined;
        const rawId =
          normalizeStringValue(bucket.bucketId ?? bucket.bucket_id) ??
          `${groupId}-${window ?? `bucket-${bucketIndex + 1}`}`;
        const label = normalizeStringValue(bucket.displayName ?? bucket.display_name) ?? rawId;
        const clampedRemaining = Math.max(0, Math.min(1, remainingFraction));
        const usedPercent = Math.round((1 - clampedRemaining) * 10000) / 100;

        return {
          id: rawId,
          label,
          window,
          usedPercent,
          resetLabel: normalizeStringValue(bucket.resetTime ?? bucket.reset_time) ?? "-",
          windowOrder: getWindowOrder(bucket)
        };
      })
      .filter((bucket): bucket is NonNullable<typeof bucket> => bucket !== null)
      .sort((a, b) => {
        const orderDiff = a.windowOrder - b.windowOrder;
        if (orderDiff !== 0) return orderDiff;
        return a.label.localeCompare(b.label);
      })
      .forEach((bucket) => {
        if (seenIds.has(bucket.id)) return;
        seenIds.add(bucket.id);
        const resetTime = bucket.resetLabel === "-" ? "-" : formatQuotaResetTime(bucket.resetLabel);
        windows.push({
          id: bucket.id,
          label: bucket.label,
          usedPercent: bucket.usedPercent,
          resetLabel: resetTime
        });
      });
  });

  return windows;
}

export function parseAntigravityQuotaSummary(
  payload: unknown
): { provider: "antigravity"; windows: QuotaWindowSummary[] } | null {
  const parsed = parseAntigravityPayload(payload);
  if (!parsed) return null;
  const windows = buildAntigravityQuotaWindows(parsed);
  if (windows.length === 0) return null;
  return { provider: "antigravity", windows };
}

export { isAntigravityFile };