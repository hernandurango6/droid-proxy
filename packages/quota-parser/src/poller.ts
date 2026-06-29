import type { AuthFileItem } from "./auth-files";
import { buildQuotaAlerts, dedupeQuotaAlerts, type QuotaAlertThresholds } from "./alerts";
import {
  fetchProviderQuotaAccount,
  PROVIDER_FILTERS,
  runWithConcurrency,
  type ProviderApiCall
} from "./provider-fetch";
import type { QuotaAlert, QuotaProvider } from "./types";

export interface ApiCallRequest {
  authIndex: string;
  method: string;
  url: string;
  header?: Record<string, string>;
  data?: string;
  timeoutMs?: number;
}

export interface ApiCallResult {
  statusCode: number;
  body?: unknown;
  bodyText?: string;
  error?: string;
  header?: Record<string, string[]>;
}

export interface QuotaPollerDependencies {
  listAuthFiles: () => Promise<AuthFileItem[]>;
  apiCall: (request: ApiCallRequest) => Promise<ApiCallResult>;
}

export interface QuotaPollerOptions {
  thresholds?: QuotaAlertThresholds;
  maxConcurrent?: number;
  apiCallTimeoutMs?: number;
  lastSentAt?: Record<string, string>;
  now?: Date;
}

async function fetchProviderQuota(
  provider: QuotaProvider,
  file: AuthFileItem,
  apiCall: ProviderApiCall,
  timeoutMs: number,
  thresholds?: QuotaAlertThresholds,
  now?: Date
): Promise<QuotaAlert[]> {
  const account = await fetchProviderQuotaAccount(provider, file, apiCall, timeoutMs);
  if (account.status !== "success") return [];
  return buildQuotaAlerts({
    provider: account.provider,
    accountName: account.accountName,
    windows: account.windows,
    thresholds,
    now
  });
}

export async function collectQuotaAlerts(
  deps: QuotaPollerDependencies,
  options: QuotaPollerOptions = {}
): Promise<{ alerts: QuotaAlert[]; lastSentAt: Record<string, string> }> {
  const authFiles = await deps.listAuthFiles();
  const maxConcurrent = options.maxConcurrent ?? 10;
  const timeoutMs = options.apiCallTimeoutMs ?? 30_000;
  const thresholds = options.thresholds;
  const apiCall: ProviderApiCall = (request) => deps.apiCall(request);

  const tasks: Array<() => Promise<QuotaAlert[]>> = [];

  for (const { provider, filter } of PROVIDER_FILTERS) {
    for (const file of authFiles) {
      if (!filter(file)) continue;
      tasks.push(() =>
        fetchProviderQuota(provider, file, apiCall, timeoutMs, thresholds, options.now)
      );
    }
  }

  const results = await runWithConcurrency(tasks, maxConcurrent);
  const combined = results.flat();

  return dedupeQuotaAlerts(
    combined,
    options.lastSentAt ?? {},
    4 * 60 * 60 * 1000,
    options.now?.getTime() ?? Date.now()
  );
}