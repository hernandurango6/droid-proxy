/**
 * Desktop IPC adapter for upstream Management Center apiClient.
 * Routes all traffic through Rust mgmt_request — no Bearer key in renderer.
 */

import { REQUEST_TIMEOUT_MS } from "@droidproxy/management-ui/utils/constants";
import { isRecord } from "@droidproxy/management-ui/utils/helpers";
import {
  appendQueryParams,
  ipcManagementRequest,
  toManagementPath
} from "@/management/adapter/ipcTransport";

type ApiClientConfig = {
  apiBase: string;
  managementKey: string;
  timeout?: number;
};

type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
  data?: unknown;
};

type RequestConfig = {
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  responseType?: string;
  timeout?: number;
};

class ApiClient {
  private timeoutMs = REQUEST_TIMEOUT_MS;

  setConfig(config: ApiClientConfig): void {
    if (config.timeout) {
      this.timeoutMs = config.timeout;
    }
  }

  private createApiError(message: string, status?: number, details?: unknown): ApiError {
    const error = new Error(message) as ApiError;
    error.name = "ApiError";
    error.status = status;
    error.details = details;
    error.data = details;
    return error;
  }

  private async requestJson<T>(
    method: string,
    url: string,
    config?: RequestConfig
  ): Promise<T> {
    const path = appendQueryParams(toManagementPath(url), config?.params);
    const controller = new AbortController();
    const timeout = config?.timeout ?? this.timeoutMs;
    const timer = window.setTimeout(() => controller.abort(), timeout);

    try {
      const response = await ipcManagementRequest(method, path, config?.data);
      if (response.status === 401) {
        window.dispatchEvent(new Event("unauthorized"));
      }

      if (response.status >= 400) {
        const details = response.body;
        const record = isRecord(details) ? (details as Record<string, unknown>) : null;
        const message =
          record && typeof record.error === "string"
            ? record.error
            : record && typeof record.message === "string"
              ? record.message
              : response.error || `Request failed (${response.status})`;
        throw this.createApiError(message, response.status, details);
      }

      this.dispatchVersionHints(response.body);
      return response.body as T;
    } catch (error) {
      if (error instanceof Error && error.name === "ApiError") {
        throw error;
      }
      const message = error instanceof Error ? error.message : "Request failed";
      throw this.createApiError(message);
    } finally {
      window.clearTimeout(timer);
    }
  }

  private dispatchVersionHints(body: unknown): void {
    if (!isRecord(body)) return;
    const record = body as Record<string, unknown>;

    const version =
      typeof record.version === "string"
        ? record.version
        : typeof record["x-cpa-version"] === "string"
          ? record["x-cpa-version"]
          : null;
    const buildDate =
      typeof record.buildDate === "string"
        ? record.buildDate
        : typeof record["x-cpa-build-date"] === "string"
          ? record["x-cpa-build-date"]
          : null;

    if (version || buildDate) {
      window.dispatchEvent(
        new CustomEvent("server-version-update", {
          detail: { version, buildDate, runtimeKind: version ? "cpa" : null }
        })
      );
    }
  }

  async get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.requestJson<T>("GET", url, config);
  }

  async post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.requestJson<T>("POST", url, { ...config, data });
  }

  async put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.requestJson<T>("PUT", url, { ...config, data });
  }

  async patch<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.requestJson<T>("PATCH", url, { ...config, data });
  }

  async delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return this.requestJson<T>("DELETE", url, config);
  }

  async getRaw(url: string, config?: RequestConfig) {
    const path = appendQueryParams(toManagementPath(url), config?.params);
    const response = await ipcManagementRequest("GET", path);

    if (response.status >= 400) {
      throw this.createApiError("Request failed", response.status, response.body);
    }

    const text =
      typeof response.body === "string" ? response.body : JSON.stringify(response.body ?? "");
    const blob = new Blob([text], { type: "application/json" });

    return {
      data: blob,
      status: response.status,
      headers: {}
    };
  }

  async postForm<T = unknown>(
    url: string,
    formData: FormData,
    config?: RequestConfig
  ): Promise<T> {
    const payload = Object.fromEntries(formData.entries());
    return this.requestJson<T>("POST", url, { ...config, data: payload });
  }

  async requestRaw(config: RequestConfig & { url?: string; method?: string }) {
    const url = config.url || "/";
    return this.getRaw(url, config);
  }
}

export const apiClient = new ApiClient();