import { invoke } from "@tauri-apps/api/core";
import type { ManagementFormField, ManagementRequest, ManagementResponse } from "@/management/types";

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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function encodeFormData(formData: FormData): Promise<ManagementFormField[]> {
  const fields: ManagementFormField[] = [];

  for (const [name, value] of formData.entries()) {
    if (value instanceof File) {
      const buffer = await value.arrayBuffer();
      fields.push({
        name,
        filename: value.name,
        content_type: value.type || "application/octet-stream",
        data_base64: bytesToBase64(new Uint8Array(buffer))
      });
      continue;
    }

    fields.push({
      name,
      data_base64: bytesToBase64(new TextEncoder().encode(String(value)))
    });
  }

  return fields;
}

export async function ipcManagementRequest(
  method: string,
  path: string,
  options?: { body?: unknown; form?: ManagementFormField[] }
): Promise<ManagementResponse> {
  const req: ManagementRequest = {
    method,
    path,
    ...(options?.body !== undefined ? { body: options.body } : {}),
    ...(options?.form ? { form: options.form } : {})
  };
  return invoke<ManagementResponse>("mgmt_request", { req });
}