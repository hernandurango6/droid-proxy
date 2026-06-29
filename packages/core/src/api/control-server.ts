import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJSON } from "../http/send-json";
import { DEFAULT_CONTROL_PORT } from "../constants/ports";
import { handleDashboardAPI } from "./routes";
import type { DashboardApiContext } from "./types";

export const CONTROL_BIND_HOST = "127.0.0.1";

export interface ControlHealthPayload {
  status: "ok" | "degraded";
  control: {
    running: boolean;
    url: string;
  };
  proxy: {
    running: boolean;
    url: string;
  };
  backend: {
    running: boolean;
    pid: number | null;
    url: string;
  };
}

export interface ControlServerOptions {
  host?: string;
  port?: number;
  apiContext: DashboardApiContext;
  getHealthPayload: () => ControlHealthPayload;
  onError?: (error: Error) => void;
}

export async function handleControlRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  options: Pick<ControlServerOptions, "apiContext" | "getHealthPayload">
): Promise<void> {
  if (req.method === "GET" && url.pathname === "/health") {
    sendJSON(res, 200, options.getHealthPayload());
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    await handleDashboardAPI(req, res, url, options.apiContext);
    return;
  }

  sendJSON(res, 404, { error: "not_found" });
}

export function createControlServer(options: ControlServerOptions): http.Server {
  const host = options.host ?? CONTROL_BIND_HOST;
  const port = options.port ?? DEFAULT_CONTROL_PORT;

  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${host}:${port}`);
    handleControlRequest(req, res, url, options).catch((error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      options.onError?.(normalized);
      if (!res.headersSent) {
        sendJSON(res, 500, { error: "control_error", message: normalized.message });
      } else {
        res.end();
      }
    });
  });
}