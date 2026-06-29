import {
  buildQuotaAlerts,
  DEFAULT_QUOTA_ALERT_THRESHOLDS,
  type QuotaAlertThresholds
} from "./alerts";
import type { AuthFileItem } from "./auth-files";
import {
  fetchProviderQuotaAccount,
  PROVIDER_FILTERS,
  runWithConcurrency,
  type ProviderApiCall
} from "./provider-fetch";
import type { ApiCallRequest, ApiCallResult } from "./poller";
import type { QuotaAccountUsage, QuotaAlert, QuotaUsageResult } from "./types";

export interface QuotaUsageDependencies {
  listAuthFiles: () => Promise<AuthFileItem[]>;
  apiCall: (request: ApiCallRequest) => Promise<ApiCallResult>;
}

export interface QuotaUsageOptions {
  thresholds?: QuotaAlertThresholds;
  maxConcurrent?: number;
  apiCallTimeoutMs?: number;
  now?: Date;
}

export async function collectQuotaUsage(
  deps: QuotaUsageDependencies,
  options: QuotaUsageOptions = {}
): Promise<QuotaUsageResult> {
  const authFiles = await deps.listAuthFiles();
  const maxConcurrent = options.maxConcurrent ?? 10;
  const timeoutMs = options.apiCallTimeoutMs ?? 30_000;
  const thresholds = options.thresholds ?? DEFAULT_QUOTA_ALERT_THRESHOLDS;
  const now = options.now ?? new Date();
  const apiCall: ProviderApiCall = (request) => deps.apiCall(request);

  const tasks: Array<() => Promise<QuotaAccountUsage>> = [];

  for (const { provider, filter } of PROVIDER_FILTERS) {
    for (const file of authFiles) {
      if (!filter(file)) continue;
      tasks.push(() => fetchProviderQuotaAccount(provider, file, apiCall, timeoutMs));
    }
  }

  const accounts = await runWithConcurrency(tasks, maxConcurrent);
  const alerts: QuotaAlert[] = [];

  for (const account of accounts) {
    if (account.status !== "success") continue;
    alerts.push(
      ...buildQuotaAlerts({
        provider: account.provider,
        accountName: account.accountName,
        windows: account.windows,
        thresholds,
        now
      })
    );
  }

  return {
    fetchedAt: now.toISOString(),
    thresholds,
    accounts,
    alerts
  };
}