import {
  isAntigravityFile,
  isClaudeFile,
  isCodexFile,
  isDisabledAuthFile,
  isKimiFile,
  isXaiFile,
  normalizeAuthIndex,
  type AuthFileItem
} from "./auth-files";
import {
  ANTIGRAVITY_QUOTA_URLS,
  ANTIGRAVITY_REQUEST_HEADERS,
  CLAUDE_REQUEST_HEADERS,
  CLAUDE_USAGE_URL,
  CODEX_RATE_LIMIT_RESET_CREDITS_URL,
  CODEX_RESET_CREDITS_REQUEST_TIMEOUT_MS,
  CODEX_USAGE_URL,
  KIMI_REQUEST_HEADERS,
  KIMI_USAGE_URL,
  XAI_BILLING_URL,
  XAI_REQUEST_HEADERS
} from "./constants";
import { normalizeCodexResetCreditsPayload } from "./codex/reset-credits";
import {
  buildCodexRequestHeader,
  resolveCodexPlanType,
  resolveCodexSubscriptionActiveUntil
} from "./codex/resolvers";
import { normalizeNumberValue, normalizeStringValue } from "./normalize";
import {
  antigravityGroupsToWindows,
  buildAntigravityQuotaGroups
} from "./providers/antigravity-groups";
import { fetchAntigravitySubscription } from "./providers/antigravity-subscription";
import { parseAntigravityPayload } from "./providers/antigravity";
import { parseClaudeQuotaSummary } from "./providers/claude";
import { parseCodexQuotaSummary, parseCodexUsagePayload } from "./providers/codex";
import { parseKimiQuotaSummary } from "./providers/kimi";
import { parseXaiQuotaSummary } from "./providers/xai";
import type { ApiCallRequest, ApiCallResult } from "./poller";
import type { QuotaAccountUsage, QuotaProvider } from "./types";

export type ProviderApiCall = (request: ApiCallRequest) => Promise<ApiCallResult>;

function resolveAntigravityProjectId(file: AuthFileItem): string {
  const direct = normalizeStringValue(file.project_id ?? file.projectId);
  if (direct) return direct;

  const metadata =
    file.metadata && typeof file.metadata === "object" ? file.metadata : null;
  const metadataProjectId = metadata
    ? normalizeStringValue(metadata.project_id ?? metadata.projectId)
    : null;
  if (metadataProjectId) return metadataProjectId;

  const attributes =
    file.attributes && typeof file.attributes === "object" ? file.attributes : null;
  const attributesProjectId = attributes
    ? normalizeStringValue(
        attributes.project_id ?? attributes.projectId ?? attributes.gemini_virtual_project
      )
    : null;
  return attributesProjectId ?? "";
}

function getApiCallBody(result: ApiCallResult): unknown {
  return result.body ?? result.bodyText;
}

function resolveResponseServerTimeOffsetMs(
  header: Record<string, string[]> | undefined
): number | null {
  if (!header) return null;
  const dateEntry = Object.entries(header).find(([key]) => key.toLowerCase() === "date");
  const rawDate = dateEntry?.[1]?.[0];
  if (!rawDate) return null;
  const serverTime = new Date(rawDate).getTime();
  if (Number.isNaN(serverTime)) return null;
  return serverTime - Date.now();
}

function skippedAccount(
  provider: QuotaProvider,
  accountName: string,
  error: string
): QuotaAccountUsage {
  return {
    provider,
    accountName,
    status: "skipped",
    error,
    windows: []
  };
}

function errorAccount(
  provider: QuotaProvider,
  accountName: string,
  error: string
): QuotaAccountUsage {
  return {
    provider,
    accountName,
    status: "error",
    error,
    windows: []
  };
}

function successAccount(
  provider: QuotaProvider,
  accountName: string,
  windows: QuotaAccountUsage["windows"],
  extras: Partial<
    Pick<
      QuotaAccountUsage,
      | "planType"
      | "subscriptionActiveUntil"
      | "rateLimitResetCreditsAvailableCount"
      | "rateLimitResetCredits"
      | "rateLimitResetCreditsError"
      | "antigravityGroups"
      | "antigravitySubscription"
      | "serverTimeOffsetMs"
    >
  > = {}
): QuotaAccountUsage {
  return {
    provider,
    accountName,
    status: "success",
    planType: extras.planType ?? null,
    windows,
    ...extras
  };
}

async function fetchCodexResetCredits(
  authIndex: string,
  requestHeader: Record<string, string>,
  apiCall: ProviderApiCall
): Promise<Pick<
  QuotaAccountUsage,
  "rateLimitResetCreditsAvailableCount" | "rateLimitResetCredits" | "rateLimitResetCreditsError"
>> {
  try {
    const result = await apiCall({
      authIndex,
      method: "GET",
      url: CODEX_RATE_LIMIT_RESET_CREDITS_URL,
      header: {
        ...requestHeader,
        Accept: "application/json",
        "OpenAI-Beta": "codex-1",
        Originator: "Codex Desktop"
      },
      timeoutMs: CODEX_RESET_CREDITS_REQUEST_TIMEOUT_MS
    });

    if (result.statusCode < 200 || result.statusCode >= 300) {
      return {
        rateLimitResetCreditsAvailableCount: null,
        rateLimitResetCredits: [],
        rateLimitResetCreditsError: result.error ?? `HTTP ${result.statusCode}`
      };
    }

    const summary = normalizeCodexResetCreditsPayload(getApiCallBody(result));
    if (summary.invalidPayload) {
      return {
        rateLimitResetCreditsAvailableCount: null,
        rateLimitResetCredits: [],
        rateLimitResetCreditsError: "Invalid reset credits payload"
      };
    }

    return {
      rateLimitResetCreditsAvailableCount: summary.availableCount,
      rateLimitResetCredits: summary.credits,
      rateLimitResetCreditsError: ""
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      rateLimitResetCreditsAvailableCount: null,
      rateLimitResetCredits: [],
      rateLimitResetCreditsError: message
    };
  }
}

export async function fetchProviderQuotaAccount(
  provider: QuotaProvider,
  file: AuthFileItem,
  apiCall: ProviderApiCall,
  timeoutMs: number
): Promise<QuotaAccountUsage> {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  const accountName = file.name;

  if (!authIndex) {
    return skippedAccount(provider, accountName, "Missing auth index");
  }

  try {
    switch (provider) {
      case "claude": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: CLAUDE_USAGE_URL,
          header: { ...CLAUDE_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return errorAccount(provider, accountName, result.error ?? `HTTP ${result.statusCode}`);
        }
        const summary = parseClaudeQuotaSummary(getApiCallBody(result));
        if (!summary) {
          return errorAccount(provider, accountName, "Unable to parse Claude quota response");
        }
        return successAccount(provider, accountName, summary.windows);
      }
      case "codex": {
        const requestHeader = buildCodexRequestHeader(file);
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: CODEX_USAGE_URL,
          header: requestHeader,
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return errorAccount(provider, accountName, result.error ?? `HTTP ${result.statusCode}`);
        }
        const body = getApiCallBody(result);
        const summary = parseCodexQuotaSummary(body);
        if (!summary) {
          return errorAccount(provider, accountName, "Unable to parse Codex quota response");
        }

        const payload = parseCodexUsagePayload(body);
        const usageResetCredits = payload?.rate_limit_reset_credits ?? payload?.rateLimitResetCredits ?? null;
        const usageResetCreditsAvailableCount = normalizeNumberValue(
          usageResetCredits?.available_count ?? usageResetCredits?.availableCount
        );
        const resetCreditsData = await fetchCodexResetCredits(authIndex, requestHeader, apiCall);
        const resetCreditsCountFromDetails =
          resetCreditsData.rateLimitResetCredits && resetCreditsData.rateLimitResetCredits.length > 0
            ? resetCreditsData.rateLimitResetCredits.length
            : null;

        return successAccount(provider, accountName, summary.windows, {
          planType: summary.planType ?? resolveCodexPlanType(file),
          subscriptionActiveUntil: resolveCodexSubscriptionActiveUntil(file),
          rateLimitResetCreditsAvailableCount:
            resetCreditsData.rateLimitResetCreditsAvailableCount ??
            resetCreditsCountFromDetails ??
            usageResetCreditsAvailableCount,
          rateLimitResetCredits: resetCreditsData.rateLimitResetCredits,
          rateLimitResetCreditsError: resetCreditsData.rateLimitResetCreditsError
        });
      }
      case "kimi": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: KIMI_USAGE_URL,
          header: { ...KIMI_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return errorAccount(provider, accountName, result.error ?? `HTTP ${result.statusCode}`);
        }
        const summary = parseKimiQuotaSummary(getApiCallBody(result));
        if (!summary) {
          return errorAccount(provider, accountName, "Unable to parse Kimi quota response");
        }
        return successAccount(provider, accountName, summary.windows);
      }
      case "xai": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: XAI_BILLING_URL,
          header: { ...XAI_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return errorAccount(provider, accountName, result.error ?? `HTTP ${result.statusCode}`);
        }
        const summary = parseXaiQuotaSummary(getApiCallBody(result));
        if (!summary) {
          return errorAccount(provider, accountName, "Unable to parse xAI quota response");
        }
        return successAccount(provider, accountName, summary.windows);
      }
      case "antigravity": {
        const projectId = resolveAntigravityProjectId(file);
        if (!projectId) {
          return skippedAccount(provider, accountName, "Missing Antigravity project id");
        }
        const requestBody = JSON.stringify({ project: projectId });
        const subscriptionPromise = fetchAntigravitySubscription(authIndex, apiCall);
        let lastError = "Unable to fetch Antigravity quota";

        for (const url of ANTIGRAVITY_QUOTA_URLS) {
          const result = await apiCall({
            authIndex,
            method: "POST",
            url,
            header: { ...ANTIGRAVITY_REQUEST_HEADERS },
            data: requestBody,
            timeoutMs
          });
          if (result.statusCode < 200 || result.statusCode >= 300) {
            lastError = result.error ?? `HTTP ${result.statusCode}`;
            continue;
          }

          const payload = parseAntigravityPayload(getApiCallBody(result));
          if (!payload || !Array.isArray(payload.groups)) {
            lastError = "Unable to parse Antigravity quota response";
            continue;
          }

          const groups = buildAntigravityQuotaGroups(payload);
          if (groups.length === 0) {
            lastError = "No Antigravity quota groups returned";
            continue;
          }

          const serverTimeOffsetMs = resolveResponseServerTimeOffsetMs(result.header);
          const nowMs = Date.now() + (serverTimeOffsetMs ?? 0);
          const subscription = await subscriptionPromise;

          return successAccount(provider, accountName, antigravityGroupsToWindows(groups, nowMs), {
            planType: subscription?.planLabel ?? null,
            antigravityGroups: groups,
            antigravitySubscription: subscription,
            serverTimeOffsetMs
          });
        }

        return errorAccount(provider, accountName, lastError);
      }
      default:
        return skippedAccount(provider, accountName, "Unsupported provider");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorAccount(provider, accountName, message);
  }
}

export const PROVIDER_FILTERS: Array<{
  provider: QuotaProvider;
  filter: (file: AuthFileItem) => boolean;
}> = [
  { provider: "claude", filter: (file) => isClaudeFile(file) && !isDisabledAuthFile(file) },
  { provider: "antigravity", filter: (file) => isAntigravityFile(file) && !isDisabledAuthFile(file) },
  { provider: "codex", filter: (file) => isCodexFile(file) && !isDisabledAuthFile(file) },
  { provider: "kimi", filter: (file) => isKimiFile(file) && !isDisabledAuthFile(file) },
  { provider: "xai", filter: (file) => isXaiFile(file) && !isDisabledAuthFile(file) }
];

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  maxConcurrent: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const current = index;
      index += 1;
      results[current] = await tasks[current]();
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}