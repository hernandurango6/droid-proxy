export type QuotaProvider = "claude" | "antigravity" | "codex" | "kimi" | "xai";

export interface QuotaAlertThresholds {
  warn: number;
  critical: number;
}

export type QuotaAccountStatus = "success" | "error" | "skipped";

import type { CodexResetCredit } from "./codex/reset-credits";

export type { CodexResetCredit };

export interface QuotaAccountUsage {
  provider: QuotaProvider;
  accountName: string;
  status: QuotaAccountStatus;
  error?: string;
  planType?: string | null;
  windows: QuotaWindowSummary[];
  subscriptionActiveUntil?: string | number | null;
  rateLimitResetCreditsAvailableCount?: number | null;
  rateLimitResetCredits?: CodexResetCredit[];
  rateLimitResetCreditsError?: string;
  antigravityGroups?: import("./providers/antigravity-groups").AntigravityQuotaGroup[];
  antigravitySubscription?: import("./providers/antigravity-groups").AntigravitySubscriptionInfo | null;
  serverTimeOffsetMs?: number | null;
}

export interface QuotaUsageResult {
  fetchedAt: string;
  thresholds: QuotaAlertThresholds;
  accounts: QuotaAccountUsage[];
  alerts: QuotaAlert[];
}

export interface QuotaWindowSummary {
  id: string;
  label: string;
  usedPercent: number | null;
  resetLabel: string;
}

export interface CodexQuotaSummary {
  provider: "codex";
  planType: string | null;
  windows: QuotaWindowSummary[];
}

export type QuotaAlertLevel = "warn" | "critical" | "exhausted";

export interface QuotaAlert {
  provider: QuotaProvider;
  accountName: string;
  windowLabel: string;
  usedPercent: number;
  level: QuotaAlertLevel;
  timestamp: string;
}

export interface CodexUsageWindow {
  used_percent?: number;
  usedPercent?: number;
  limit_window_seconds?: number;
  limitWindowSeconds?: number;
  reset_at?: number;
  resetAt?: number;
  reset_after_seconds?: number;
  resetAfterSeconds?: number;
}

export interface CodexRateLimitInfo {
  primary_window?: CodexUsageWindow | null;
  primaryWindow?: CodexUsageWindow | null;
  secondary_window?: CodexUsageWindow | null;
  secondaryWindow?: CodexUsageWindow | null;
  limit_reached?: boolean;
  limitReached?: boolean;
  allowed?: boolean;
}

export interface CodexRateLimitResetCredits {
  available_count?: number;
  availableCount?: number;
  credits?: unknown[];
}

export interface CodexUsagePayload {
  plan_type?: string;
  planType?: string;
  rate_limit_reset_credits?: CodexRateLimitResetCredits | null;
  rateLimitResetCredits?: CodexRateLimitResetCredits | null;
  rate_limit?: CodexRateLimitInfo | null;
  rateLimit?: CodexRateLimitInfo | null;
  code_review_rate_limit?: CodexRateLimitInfo | null;
  codeReviewRateLimit?: CodexRateLimitInfo | null;
  additional_rate_limits?: Array<{
    limit_name?: string;
    limitName?: string;
    metered_feature?: string;
    meteredFeature?: string;
    rate_limit?: CodexRateLimitInfo | null;
    rateLimit?: CodexRateLimitInfo | null;
  }>;
  additionalRateLimits?: Array<{
    limit_name?: string;
    limitName?: string;
    metered_feature?: string;
    meteredFeature?: string;
    rate_limit?: CodexRateLimitInfo | null;
    rateLimit?: CodexRateLimitInfo | null;
  }>;
}