import type { ManagementClient } from "./client";
import type { AuthFileItem } from "./types";

function normalizeAuthFilesPayload(payload: unknown): AuthFileItem[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is AuthFileItem => Boolean(item && typeof item === "object"));
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.files, record.auth_files, record.authFiles];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is AuthFileItem => Boolean(item && typeof item === "object"));
      }
    }
  }

  return [];
}

export async function listAuthFiles(client: ManagementClient): Promise<AuthFileItem[]> {
  const response = await client.request<unknown>("/auth-files");
  if (!response.ok) {
    throw new Error(`Failed to list auth files: HTTP ${response.status}`);
  }
  return normalizeAuthFilesPayload(response.data);
}