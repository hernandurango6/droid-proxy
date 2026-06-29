import type { AuthFileItem } from "../auth-files";
import { CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL } from "../constants";
import { normalizeAuthIndex } from "../auth-files";
import type { ApiCallRequest, ApiCallResult } from "../poller";
import { buildCodexRequestHeader } from "./resolvers";

export function createCodexRedeemRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const segment = char === "x" ? value : (value & 0x3) | 0x8;
    return segment.toString(16);
  });
}

export async function consumeCodexRateLimitResetCredit(
  file: AuthFileItem,
  apiCall: (request: ApiCallRequest) => Promise<ApiCallResult>
): Promise<void> {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    throw new Error("Missing auth index for Codex account");
  }

  const result = await apiCall({
    authIndex,
    method: "POST",
    url: CODEX_RATE_LIMIT_RESET_CREDITS_CONSUME_URL,
    header: buildCodexRequestHeader(file),
    data: JSON.stringify({
      redeem_request_id: createCodexRedeemRequestId()
    })
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(result.error ?? `Codex reset failed with HTTP ${result.statusCode}`);
  }
}