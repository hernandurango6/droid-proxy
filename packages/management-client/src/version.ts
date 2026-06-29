import type { ManagementClient } from "./client";
import { pickString } from "./normalize";
import type { ManagementVersionInfo } from "./types";

export async function getManagementVersion(client: ManagementClient): Promise<string | null> {
  const response = await client.request<ManagementVersionInfo | string>("/version");
  if (!response.ok) {
    throw new Error(`Failed to read management version: HTTP ${response.status}`);
  }

  if (typeof response.data === "string") {
    return response.data.trim() || null;
  }

  if (response.data && typeof response.data === "object") {
    return pickString(response.data as Record<string, unknown>, ["version", "app_version", "appVersion"]);
  }

  return null;
}