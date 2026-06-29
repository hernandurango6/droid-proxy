import type { IncomingMessage, ServerResponse } from "node:http";
import { handleDashboardAPI } from "./routes";
import { serveDashboardAsset } from "./serve-asset";
import type { DashboardApiContext } from "./types";

export function requestHost(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

export async function handleDashboardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    dashboardDir: string;
    dashboardHost: string;
    dashboardPort: number;
    apiContext: DashboardApiContext;
  }
): Promise<void> {
  const url = new URL(
    req.url || "/",
    `http://${requestHost(options.dashboardHost)}:${options.dashboardPort}`
  );

  if (url.pathname.startsWith("/api/")) {
    await handleDashboardAPI(req, res, url, options.apiContext);
    return;
  }

  serveDashboardAsset(options.dashboardDir, url.pathname, res);
}