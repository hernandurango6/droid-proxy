import { ANTIGRAVITY_CODE_ASSIST_URL, ANTIGRAVITY_REQUEST_HEADERS } from "../constants";
import { normalizeStringValue, parseJsonPayload } from "../normalize";
import type { ProviderApiCall } from "../provider-fetch";
import type { AntigravitySubscriptionInfo } from "./antigravity-groups";

const CODE_ASSIST_REQUEST_BODY = JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } });

const PLAN_BY_TIER_ID = new Map<string, string>([
  ["free-tier", "free"],
  ["g1-pro-tier", "pro"],
  ["g1-ultra-tier", "ultra"],
  ["g1-ultra-lite-tier", "ultra-lite"]
]);

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
  "ultra-lite": "Ultra Lite",
  unknown: "Unknown"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTier(value: unknown): { id: string | null; name: string | null } | null {
  if (!isRecord(value)) return null;
  return {
    id: normalizeStringValue(value.id),
    name: normalizeStringValue(value.name)
  };
}

function resolvePlan(tierId: string | null): string {
  if (!tierId) return "unknown";
  return PLAN_BY_TIER_ID.get(tierId) ?? "unknown";
}

export function parseAntigravitySubscriptionSummary(payload: unknown): AntigravitySubscriptionInfo | null {
  const parsed = parseJsonPayload<Record<string, unknown>>(payload);
  if (!parsed) return null;

  const currentTier = normalizeTier(parsed.currentTier ?? parsed.current_tier);
  const paidTier = normalizeTier(parsed.paidTier ?? parsed.paid_tier);
  const effectiveTier = paidTier?.id ? paidTier : currentTier;
  if (!effectiveTier?.id && !effectiveTier?.name) return null;

  const plan = resolvePlan(effectiveTier.id);
  const planLabel =
    PLAN_LABELS[plan] ?? effectiveTier.name ?? effectiveTier.id ?? PLAN_LABELS.unknown;

  return {
    plan,
    tierId: effectiveTier.id,
    tierName: effectiveTier.name,
    planLabel
  };
}

export async function fetchAntigravitySubscription(
  authIndex: string,
  apiCall: ProviderApiCall
): Promise<AntigravitySubscriptionInfo | null> {
  try {
    const result = await apiCall({
      authIndex,
      method: "POST",
      url: ANTIGRAVITY_CODE_ASSIST_URL,
      header: { ...ANTIGRAVITY_REQUEST_HEADERS },
      data: CODE_ASSIST_REQUEST_BODY
    });

    if (result.statusCode < 200 || result.statusCode >= 300) {
      return null;
    }

    return parseAntigravitySubscriptionSummary(result.body ?? result.bodyText);
  } catch {
    return null;
  }
}