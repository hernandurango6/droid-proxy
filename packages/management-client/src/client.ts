import { normalizeManagementBaseUrl, normalizeManagementPath, parseResponseBody } from "./normalize";
import type { ManagementClientOptions, ManagementRequestInit, ManagementResponse } from "./types";

export class ManagementClient {
  readonly baseUrl: string;
  readonly secretKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ManagementClientOptions) {
    this.baseUrl = normalizeManagementBaseUrl(options.baseUrl);
    this.secretKey = options.secretKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async request<T = unknown>(
    path: string,
    init: ManagementRequestInit = {}
  ): Promise<ManagementResponse<T>> {
    const method = (init.method || "GET").toUpperCase();
    const normalizedPath = normalizeManagementPath(path);
    const url = `${this.baseUrl}${normalizedPath}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.secretKey}`,
      Accept: "application/json",
      ...init.headers
    };

    let body: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(init.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      const text = await response.text();
      const data = parseResponseBody(text) as T;
      return {
        ok: response.ok,
        status: response.status,
        data,
        text
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}