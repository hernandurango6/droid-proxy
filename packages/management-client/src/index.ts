import { BACKEND_HOST, DEFAULT_BACKEND_PORT, getManagementUrl } from "@droidproxy/core";

export const MANAGEMENT_CLIENT_PACKAGE_NAME = "@droidproxy/management-client";

export function getDefaultManagementBaseUrl(
  backendHost: string = BACKEND_HOST,
  backendPort: number = DEFAULT_BACKEND_PORT
): string {
  const managementPageUrl = getManagementUrl(backendHost, backendPort);
  return managementPageUrl.replace(/\/management\.html$/, "/v0/management");
}