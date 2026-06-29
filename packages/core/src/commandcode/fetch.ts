import crypto from "node:crypto";
import { DEFAULT_COMMANDCODE_API_URL } from "../constants/ports";
import { CommandCodeApiKeyRotator } from "./api-keys";

export function shouldRetryCommandCodeStatus(status: number): boolean {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

export async function fetchCommandCodeWithApiKeys(
  apiKeys: string[],
  body: string,
  options: {
    apiUrl?: string;
    rotator?: CommandCodeApiKeyRotator;
    onLog?: (message: string) => void;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<Response> {
  const apiUrl = options.apiUrl ?? DEFAULT_COMMANDCODE_API_URL;
  const rotator = options.rotator ?? new CommandCodeApiKeyRotator();
  const fetchImpl = options.fetchImpl ?? fetch;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const selection = rotator.next(apiKeys);

    try {
      const response = await fetchImpl(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${selection.apiKey}`,
          "x-session-id": crypto.randomUUID(),
          "x-command-code-version": "0.25.7",
          "x-cli-environment": "cli"
        },
        body
      });

      if (response.ok || !shouldRetryCommandCodeStatus(response.status) || attempt === apiKeys.length - 1) {
        return response;
      }

      await response.text().catch(() => "");
      options.onLog?.(`CommandCode key ${selection.index + 1}/${apiKeys.length} returned HTTP ${response.status}; trying next key`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === apiKeys.length - 1) throw lastError;
      options.onLog?.(`CommandCode key ${selection.index + 1}/${apiKeys.length} failed: ${lastError.message}; trying next key`);
    }
  }

  throw lastError || new Error("No CommandCode API key attempt was made");
}