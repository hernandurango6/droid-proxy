import type { ManagementClient } from "./client";
import { pickNumber, pickString } from "./normalize";
import type { ApiCallRequest, ApiCallResult } from "./types";

function normalizeApiCallResult(payload: unknown, fallbackStatus: number): ApiCallResult {
  if (!payload || typeof payload !== "object") {
    return {
      statusCode: fallbackStatus,
      bodyText: typeof payload === "string" ? payload : "",
      error: "Invalid api-call response"
    };
  }

  const record = payload as Record<string, unknown>;
  const statusCode = pickNumber(record, ["status_code", "statusCode"]) ?? fallbackStatus;
  const bodyText = pickString(record, ["body_text", "bodyText"]) ?? undefined;
  const body = record.body ?? bodyText;
  const header = record.header as Record<string, string[]> | undefined;
  const error = pickString(record, ["error", "message"]) ?? undefined;

  return {
    statusCode,
    body,
    bodyText: typeof body === "string" ? body : bodyText,
    header,
    error
  };
}

export async function apiCall(
  client: ManagementClient,
  request: ApiCallRequest
): Promise<ApiCallResult> {
  const response = await client.request("/api-call", {
    method: "POST",
    body: {
      auth_index: request.authIndex,
      method: request.method,
      url: request.url,
      header: request.header ?? {},
      data: request.data ?? ""
    },
    headers: request.timeoutMs
      ? { "X-Request-Timeout-Ms": String(request.timeoutMs) }
      : undefined
  });

  return normalizeApiCallResult(response.data, response.status);
}

export function getApiCallErrorMessage(result: ApiCallResult): string {
  if (result.error) return result.error;
  if (typeof result.body === "string" && result.body.trim()) return result.body.slice(0, 500);
  if (result.body && typeof result.body === "object") {
    const record = result.body as Record<string, unknown>;
    const message = pickString(record, ["error", "message", "detail"]);
    if (message) return message;
  }
  return `HTTP ${result.statusCode}`;
}