import { normalizeNumberValue, normalizeStringValue, parseJsonPayload } from "../normalize";
import type { QuotaWindowSummary } from "../types";
import { isXaiFile, type AuthFileItem } from "../auth-files";

interface XaiBillingConfig {
  monthlyLimit?: unknown;
  monthly_limit?: unknown;
  used?: unknown;
  onDemandCap?: unknown;
  on_demand_cap?: unknown;
  billingPeriodStart?: string;
  billing_period_start?: string;
  billingPeriodEnd?: string;
  billing_period_end?: string;
}

interface XaiBillingPayload {
  config?: XaiBillingConfig;
}

function normalizeXaiCentValue(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return normalizeNumberValue((value as { val?: unknown }).val);
  }
  return normalizeNumberValue(value);
}

export function parseXaiBillingPayload(payload: unknown): XaiBillingPayload | null {
  return parseJsonPayload<XaiBillingPayload>(payload);
}

export function buildXaiQuotaWindows(config: XaiBillingConfig | null | undefined): QuotaWindowSummary[] {
  if (!config || typeof config !== "object") return [];

  const monthlyLimitCents = normalizeXaiCentValue(config.monthlyLimit ?? config.monthly_limit);
  const usedCents = normalizeXaiCentValue(config.used);
  const billingPeriodEnd =
    normalizeStringValue(config.billingPeriodEnd ?? config.billing_period_end) ?? undefined;

  if (
    monthlyLimitCents === null &&
    usedCents === null &&
    !billingPeriodEnd
  ) {
    return [];
  }

  const usedPercent =
    monthlyLimitCents !== null && monthlyLimitCents > 0 && usedCents !== null
      ? Math.round((usedCents / monthlyLimitCents) * 10000) / 100
      : null;

  return [
    {
      id: "monthly",
      label: "Monthly billing",
      usedPercent,
      resetLabel: billingPeriodEnd ?? "-"
    }
  ];
}

export function parseXaiQuotaSummary(payload: unknown): { provider: "xai"; windows: QuotaWindowSummary[] } | null {
  const parsed = parseXaiBillingPayload(payload);
  if (!parsed) return null;
  const windows = buildXaiQuotaWindows(parsed.config);
  if (windows.length === 0) return null;
  return { provider: "xai", windows };
}

export { isXaiFile };