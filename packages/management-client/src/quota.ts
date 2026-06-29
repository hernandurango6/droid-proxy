import {
  collectQuotaUsage,
  consumeCodexRateLimitResetCredit,
  isCodexFile,
  type ApiCallRequest,
  type QuotaUsageResult
} from "@droidproxy/quota-parser";
import { apiCall } from "./api-call";
import { listAuthFiles } from "./auth-files";
import { ManagementClient } from "./client";
import { normalizeManagementBaseUrl } from "./normalize";

export interface FetchQuotaUsageOptions {
  managementUrl: string;
  secretKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function createManagementClient(options: FetchQuotaUsageOptions): ManagementClient {
  const baseUrl = normalizeManagementBaseUrl(
    options.managementUrl.replace(/\/management\.html$/i, "/v0/management")
  );
  return new ManagementClient({
    baseUrl,
    secretKey: options.secretKey,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs
  });
}

function createQuotaDeps(client: ManagementClient) {
  const call = (request: ApiCallRequest) =>
    apiCall(client, {
      authIndex: request.authIndex,
      method: request.method,
      url: request.url,
      header: request.header,
      data: request.data,
      timeoutMs: request.timeoutMs
    });

  return {
    listAuthFiles: () => listAuthFiles(client),
    apiCall: call
  };
}

export async function fetchQuotaUsage(options: FetchQuotaUsageOptions): Promise<QuotaUsageResult> {
  const client = createManagementClient(options);
  return collectQuotaUsage(createQuotaDeps(client));
}

export async function resetCodexQuotaUsage(
  options: FetchQuotaUsageOptions & { accountName: string }
): Promise<QuotaUsageResult> {
  const client = createManagementClient(options);
  const files = await listAuthFiles(client);
  const file = files.find((entry) => entry.name === options.accountName);
  if (!file || !isCodexFile(file)) {
    throw new Error(`Codex account not found: ${options.accountName}`);
  }

  const deps = createQuotaDeps(client);
  await consumeCodexRateLimitResetCredit(file, deps.apiCall);
  return collectQuotaUsage(deps);
}