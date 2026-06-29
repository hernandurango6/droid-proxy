import { formatCodexResetLabel } from "../formatters";
import { normalizeNumberValue, normalizePlanType, normalizeStringValue } from "../normalize";
import type {
  CodexQuotaSummary,
  CodexRateLimitInfo,
  CodexUsagePayload,
  CodexUsageWindow,
  QuotaWindowSummary
} from "../types";

const FIVE_HOUR_SECONDS = 18_000;
const WEEK_SECONDS = 604_800;
const MIN_MONTH_SECONDS = 28 * 24 * 60 * 60;
const MAX_MONTH_SECONDS = 31 * 24 * 60 * 60;

export function parseCodexUsagePayload(payload: unknown): CodexUsagePayload | null {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as CodexUsagePayload;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") {
    return payload as CodexUsagePayload;
  }
  return null;
}

function getWindowSeconds(window?: CodexUsageWindow | null): number | null {
  if (!window) return null;
  return normalizeNumberValue(window.limit_window_seconds ?? window.limitWindowSeconds);
}

function isMonthlyWindow(window?: CodexUsageWindow | null): boolean {
  const seconds = getWindowSeconds(window);
  return seconds !== null && seconds >= MIN_MONTH_SECONDS && seconds <= MAX_MONTH_SECONDS;
}

function pickClassifiedWindows(
  limitInfo?: CodexRateLimitInfo | null,
  options: { allowOrderFallback?: boolean } = {}
): { fiveHourWindow: CodexUsageWindow | null; weeklyWindow: CodexUsageWindow | null } {
  const allowOrderFallback = options.allowOrderFallback ?? true;
  const primaryWindow = limitInfo?.primary_window ?? limitInfo?.primaryWindow ?? null;
  const secondaryWindow = limitInfo?.secondary_window ?? limitInfo?.secondaryWindow ?? null;
  const rawWindows = [primaryWindow, secondaryWindow];

  let fiveHourWindow: CodexUsageWindow | null = null;
  let weeklyWindow: CodexUsageWindow | null = null;

  for (const window of rawWindows) {
    if (!window) continue;
    const seconds = getWindowSeconds(window);
    if (seconds === FIVE_HOUR_SECONDS && !fiveHourWindow) {
      fiveHourWindow = window;
    } else if ((seconds === WEEK_SECONDS || isMonthlyWindow(window)) && !weeklyWindow) {
      weeklyWindow = window;
    }
  }

  if (allowOrderFallback) {
    if (!fiveHourWindow) {
      fiveHourWindow = primaryWindow && primaryWindow !== weeklyWindow ? primaryWindow : null;
    }
    if (!weeklyWindow) {
      weeklyWindow = secondaryWindow && secondaryWindow !== fiveHourWindow ? secondaryWindow : null;
    }
  }

  return { fiveHourWindow, weeklyWindow };
}

function selectSecondaryLabel(window: CodexUsageWindow | null | undefined): string {
  return isMonthlyWindow(window) ? "Monthly window" : "Weekly window";
}

export function buildCodexQuotaWindows(payload: CodexUsagePayload): QuotaWindowSummary[] {
  const rateLimit = payload.rate_limit ?? payload.rateLimit ?? undefined;
  const codeReviewLimit = payload.code_review_rate_limit ?? payload.codeReviewRateLimit ?? undefined;
  const additionalRateLimits = payload.additional_rate_limits ?? payload.additionalRateLimits ?? [];
  const windows: QuotaWindowSummary[] = [];

  const addWindow = (
    id: string,
    label: string,
    window?: CodexUsageWindow | null,
    limitReached?: boolean,
    allowed?: boolean
  ) => {
    if (!window) return;
    const resetLabel = formatCodexResetLabel(window);
    const usedPercentRaw = normalizeNumberValue(window.used_percent ?? window.usedPercent);
    const isLimitReached = Boolean(limitReached) || allowed === false;
    const usedPercent = usedPercentRaw ?? (isLimitReached && resetLabel !== "-" ? 100 : null);
    windows.push({ id, label, usedPercent, resetLabel });
  };

  const rateWindows = pickClassifiedWindows(rateLimit);
  const rawLimitReached = rateLimit?.limit_reached ?? rateLimit?.limitReached;
  const rawAllowed = rateLimit?.allowed;
  addWindow("five-hour", "5-hour window", rateWindows.fiveHourWindow, rawLimitReached, rawAllowed);
  addWindow(
    isMonthlyWindow(rateWindows.weeklyWindow) ? "monthly" : "weekly",
    selectSecondaryLabel(rateWindows.weeklyWindow),
    rateWindows.weeklyWindow,
    rawLimitReached,
    rawAllowed
  );

  const codeReviewWindows = pickClassifiedWindows(codeReviewLimit);
  const codeReviewLimitReached = codeReviewLimit?.limit_reached ?? codeReviewLimit?.limitReached;
  const codeReviewAllowed = codeReviewLimit?.allowed;
  addWindow(
    "code-review-five-hour",
    "Code review 5-hour window",
    codeReviewWindows.fiveHourWindow,
    codeReviewLimitReached,
    codeReviewAllowed
  );
  addWindow(
    isMonthlyWindow(codeReviewWindows.weeklyWindow) ? "code-review-monthly" : "code-review-weekly",
    `Code review ${selectSecondaryLabel(codeReviewWindows.weeklyWindow).toLowerCase()}`,
    codeReviewWindows.weeklyWindow,
    codeReviewLimitReached,
    codeReviewAllowed
  );

  if (Array.isArray(additionalRateLimits)) {
    additionalRateLimits.forEach((limitItem, index) => {
      const rateInfo = limitItem?.rate_limit ?? limitItem?.rateLimit ?? null;
      if (!rateInfo) return;

      const limitName =
        normalizeStringValue(limitItem?.limit_name ?? limitItem?.limitName)
        ?? normalizeStringValue(limitItem?.metered_feature ?? limitItem?.meteredFeature)
        ?? `additional-${index + 1}`;
      const idPrefix = limitName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
        || `additional-${index + 1}`;
      const additionalPrimaryWindow = rateInfo.primary_window ?? rateInfo.primaryWindow ?? null;
      const additionalSecondaryWindow = rateInfo.secondary_window ?? rateInfo.secondaryWindow ?? null;
      const additionalLimitReached = rateInfo.limit_reached ?? rateInfo.limitReached;
      const additionalAllowed = rateInfo.allowed;

      addWindow(
        `${idPrefix}-five-hour-${index}`,
        `${limitName} 5-hour window`,
        additionalPrimaryWindow,
        additionalLimitReached,
        additionalAllowed
      );
      addWindow(
        `${idPrefix}-${isMonthlyWindow(additionalSecondaryWindow) ? "monthly" : "weekly"}-${index}`,
        `${limitName} ${selectSecondaryLabel(additionalSecondaryWindow).toLowerCase()}`,
        additionalSecondaryWindow,
        additionalLimitReached,
        additionalAllowed
      );
    });
  }

  return windows;
}

export function parseCodexQuotaSummary(payload: unknown): CodexQuotaSummary | null {
  const parsed = parseCodexUsagePayload(payload);
  if (!parsed) return null;

  const windows = buildCodexQuotaWindows(parsed);
  if (windows.length === 0) return null;

  return {
    provider: "codex",
    planType: normalizePlanType(parsed.plan_type ?? parsed.planType),
    windows
  };
}

export function isCodexAuthFile(file: Record<string, unknown>): boolean {
  const type = normalizeStringValue(file.type)?.toLowerCase();
  return type === "codex" || type === "openai-codex";
}