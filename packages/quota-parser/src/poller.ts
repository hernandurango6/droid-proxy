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
import { buildQuotaAlerts, dedupeQuotaAlerts, type QuotaAlertThresholds } from "./alerts";
import {
  ANTIGRAVITY_QUOTA_URLS,
  ANTIGRAVITY_REQUEST_HEADERS,
  CLAUDE_REQUEST_HEADERS,
  CLAUDE_USAGE_URL,
  CODEX_REQUEST_HEADERS,
  CODEX_USAGE_URL,
  KIMI_REQUEST_HEADERS,
  KIMI_USAGE_URL,
  XAI_BILLING_URL,
  XAI_REQUEST_HEADERS
} from "./constants";
import { parseAntigravityQuotaSummary } from "./providers/antigravity";
import { parseClaudeQuotaSummary } from "./providers/claude";
import { parseCodexQuotaSummary } from "./providers/codex";
import { parseKimiQuotaSummary } from "./providers/kimi";
import { parseXaiQuotaSummary } from "./providers/xai";
import { normalizeStringValue } from "./normalize";
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

const PROVIDER_FILTERS: Array<{ provider: QuotaProvider; filter: (file: AuthFileItem) => boolean }> = [
  { provider: "claude", filter: (file) => isClaudeFile(file) && !isDisabledAuthFile(file) },
  { provider: "antigravity", filter: (file) => isAntigravityFile(file) && !isDisabledAuthFile(file) },
  { provider: "codex", filter: (file) => isCodexFile(file) && !isDisabledAuthFile(file) },
  { provider: "kimi", filter: (file) => isKimiFile(file) && !isDisabledAuthFile(file) },
  { provider: "xai", filter: (file) => isXaiFile(file) && !isDisabledAuthFile(file) }
];

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

async function runWithConcurrency<T>(
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

function getApiCallBody(result: ApiCallResult): unknown {
  return result.body ?? result.bodyText;
}

async function fetchProviderQuota(
  provider: QuotaProvider,
  file: AuthFileItem,
  apiCall: QuotaPollerDependencies["apiCall"],
  timeoutMs: number,
  thresholds?: QuotaAlertThresholds,
  now?: Date
): Promise<QuotaAlert[]> {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) return [];

  const accountName = file.name;

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
        if (result.statusCode < 200 || result.statusCode >= 300) return [];
        const summary = parseClaudeQuotaSummary(getApiCallBody(result));
        if (!summary) return [];
        return buildQuotaAlerts({ provider, accountName, windows: summary.windows, thresholds, now });
      }
      case "codex": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: CODEX_USAGE_URL,
          header: { ...CODEX_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) return [];
        const summary = parseCodexQuotaSummary(getApiCallBody(result));
        if (!summary) return [];
        return buildQuotaAlerts({ provider, accountName, windows: summary.windows, thresholds, now });
      }
      case "kimi": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: KIMI_USAGE_URL,
          header: { ...KIMI_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) return [];
        const summary = parseKimiQuotaSummary(getApiCallBody(result));
        if (!summary) return [];
        return buildQuotaAlerts({ provider, accountName, windows: summary.windows, thresholds, now });
      }
      case "xai": {
        const result = await apiCall({
          authIndex,
          method: "GET",
          url: XAI_BILLING_URL,
          header: { ...XAI_REQUEST_HEADERS },
          timeoutMs
        });
        if (result.statusCode < 200 || result.statusCode >= 300) return [];
        const summary = parseXaiQuotaSummary(getApiCallBody(result));
        if (!summary) return [];
        return buildQuotaAlerts({ provider, accountName, windows: summary.windows, thresholds, now });
      }
      case "antigravity": {
        const projectId = resolveAntigravityProjectId(file);
        if (!projectId) return [];
        const requestBody = JSON.stringify({ project: projectId });

        for (const url of ANTIGRAVITY_QUOTA_URLS) {
          const result = await apiCall({
            authIndex,
            method: "POST",
            url,
            header: { ...ANTIGRAVITY_REQUEST_HEADERS },
            data: requestBody,
            timeoutMs
          });
          if (result.statusCode < 200 || result.statusCode >= 300) continue;
          const summary = parseAntigravityQuotaSummary(getApiCallBody(result));
          if (!summary) continue;
          return buildQuotaAlerts({ provider, accountName, windows: summary.windows, thresholds, now });
        }
        return [];
      }
      default:
        return [];
    }
  } catch {
    return [];
  }
}

export async function collectQuotaAlerts(
  deps: QuotaPollerDependencies,
  options: QuotaPollerOptions = {}
): Promise<{ alerts: QuotaAlert[]; lastSentAt: Record<string, string> }> {
  const authFiles = await deps.listAuthFiles();
  const maxConcurrent = options.maxConcurrent ?? 10;
  const timeoutMs = options.apiCallTimeoutMs ?? 30_000;
  const thresholds = options.thresholds;

  const tasks: Array<() => Promise<QuotaAlert[]>> = [];

  for (const { provider, filter } of PROVIDER_FILTERS) {
    for (const file of authFiles) {
      if (!filter(file)) continue;
      tasks.push(() =>
        fetchProviderQuota(
          provider,
          file,
          deps.apiCall,
          timeoutMs,
          thresholds,
          options.now
        )
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