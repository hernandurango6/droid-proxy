import { normalizeQuotaFraction, normalizeStringValue } from "../normalize";

export interface AntigravityQuotaBucket {
  id: string;
  label: string;
  window?: string;
  remainingFraction: number;
  resetTime?: string;
  description?: string;
}

export interface AntigravityQuotaGroup {
  id: string;
  label: string;
  description?: string;
  buckets: AntigravityQuotaBucket[];
}

export interface AntigravitySubscriptionInfo {
  plan: string;
  tierId: string | null;
  tierName: string | null;
  planLabel: string;
}

interface AntigravityGroupPayload {
  displayName?: string;
  display_name?: string;
  description?: string;
  buckets?: AntigravityBucketPayload[];
}

interface AntigravityBucketPayload {
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

const BUCKET_WINDOW_ORDER = new Map<string, number>([
  ["5h", 0],
  ["five-hour", 0],
  ["five_hour", 0],
  ["weekly", 1],
  ["week", 1]
]);

function toStableId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function getWindowOrder(bucket: AntigravityQuotaBucket): number {
  const window = bucket.window?.toLowerCase();
  if (!window) return Number.MAX_SAFE_INTEGER;
  return BUCKET_WINDOW_ORDER.get(window) ?? Number.MAX_SAFE_INTEGER;
}

export function buildAntigravityQuotaGroups(payload: {
  groups?: AntigravityGroupPayload[];
}): AntigravityQuotaGroup[] {
  const groups = Array.isArray(payload.groups) ? payload.groups : [];

  return groups
    .map((group, groupIndex): AntigravityQuotaGroup | null => {
      const label =
        normalizeStringValue(group.displayName ?? group.display_name) ??
        `Quota Group ${groupIndex + 1}`;
      const groupId = toStableId(label, `quota-group-${groupIndex + 1}`);
      const buckets = Array.isArray(group.buckets) ? group.buckets : [];
      const parsedBuckets = buckets
        .map((bucket, bucketIndex): AntigravityQuotaBucket | null => {
          const remainingFraction = normalizeQuotaFraction(
            bucket.remainingFraction ?? bucket.remaining_fraction
          );
          if (remainingFraction === null) return null;

          const window = normalizeStringValue(bucket.window) ?? undefined;
          const rawId =
            normalizeStringValue(bucket.bucketId ?? bucket.bucket_id) ??
            `${groupId}-${window ?? `bucket-${bucketIndex + 1}`}`;
          const bucketLabel =
            normalizeStringValue(bucket.displayName ?? bucket.display_name) ?? rawId;

          return {
            id: rawId,
            label: bucketLabel,
            window,
            remainingFraction,
            resetTime: normalizeStringValue(bucket.resetTime ?? bucket.reset_time) ?? undefined,
            description: normalizeStringValue(bucket.description) ?? undefined
          };
        })
        .filter((bucket): bucket is AntigravityQuotaBucket => bucket !== null)
        .sort((a, b) => {
          const orderDiff = getWindowOrder(a) - getWindowOrder(b);
          if (orderDiff !== 0) return orderDiff;
          return a.label.localeCompare(b.label);
        });

      if (parsedBuckets.length === 0) return null;

      return {
        id: groupId,
        label,
        description: normalizeStringValue(group.description) ?? undefined,
        buckets: parsedBuckets
      };
    })
    .filter((group): group is AntigravityQuotaGroup => group !== null);
}

export function formatAntigravityDuration(deltaMs: number): string {
  const totalMinutes = Math.max(1, Math.ceil(deltaMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "<1m";
}

export function formatAntigravityResetLabel(resetTime: string | undefined, nowMs: number): string {
  if (!resetTime) return "—";
  const resetMs = new Date(resetTime).getTime();
  if (Number.isNaN(resetMs)) return "—";
  const deltaMs = resetMs - nowMs;
  if (deltaMs <= 0) return "Quota available";
  return `Refreshes in ${formatAntigravityDuration(deltaMs)}`;
}

export function formatAntigravityGroupDescription(description?: string): string | undefined {
  if (!description) return undefined;
  const modelsMatch = description.match(/^models within this group:\s*(.+)$/i);
  if (modelsMatch) {
    return `Models in this group: ${modelsMatch[1].trim()}`;
  }
  return description;
}

const GROUP_LABELS = new Map<string, string>([
  ["gemini models", "Gemini models"],
  ["claude and gpt models", "Claude and GPT models"]
]);

const BUCKET_LABELS = new Map<string, string>([
  ["weekly limit", "Weekly limit"],
  ["daily limit", "Daily limit"],
  ["5 hour limit", "5-hour limit"],
  ["5-hour limit", "5-hour limit"],
  ["five hour limit", "5-hour limit"],
  ["monthly limit", "Monthly limit"]
]);

function normalizeLabelKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatAntigravityGroupLabel(value: string): string {
  return GROUP_LABELS.get(normalizeLabelKey(value)) ?? value;
}

export function formatAntigravityBucketLabel(value: string): string {
  return BUCKET_LABELS.get(normalizeLabelKey(value)) ?? value;
}

export function getAntigravityPlanLabel(subscription: AntigravitySubscriptionInfo | null): string | null {
  if (!subscription) return null;
  return subscription.planLabel;
}

export function antigravityGroupsToWindows(
  groups: AntigravityQuotaGroup[],
  nowMs = Date.now()
): import("../types").QuotaWindowSummary[] {
  const windows: import("../types").QuotaWindowSummary[] = [];

  for (const group of groups) {
    for (const bucket of group.buckets) {
      const clamped = Math.max(0, Math.min(1, bucket.remainingFraction));
      const usedPercent = Math.round((1 - clamped) * 10000) / 100;
      windows.push({
        id: `${group.id}:${bucket.id}`,
        label: `${formatAntigravityGroupLabel(group.label)} · ${formatAntigravityBucketLabel(bucket.label)}`,
        usedPercent,
        resetLabel: formatAntigravityResetLabel(bucket.resetTime, nowMs)
      });
    }
  }

  return windows;
}