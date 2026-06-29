import { invoke } from "@tauri-apps/api/core";
import type { ManagementRequest, ManagementResponse } from "@/management/types";

const MANAGEMENT_PREFIX = "/v0/management";

export function toManagementPath(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return MANAGEMENT_PREFIX;

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash.startsWith(MANAGEMENT_PREFIX)) {
    return withLeadingSlash;
  }

  return `${MANAGEMENT_PREFIX}${withLeadingSlash}`;
}

export function appendQueryParams(path: string, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return path;

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function ipcManagementRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<ManagementResponse> {
  const req: ManagementRequest = { method, path, ...(body !== undefined ? { body } : {}) };
  return invoke<ManagementResponse>("mgmt_request", { req });
}