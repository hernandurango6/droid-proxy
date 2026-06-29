import type { ServerResponse } from "node:http";
import { commandCodeOpenAIModels } from "../commandcode/models";
import { sendJSON } from "../http/send-json";
import { requestJSON } from "./http";

export interface ProxyModelsContext {
  backendHost: string;
  backendPort: number;
  onLog?: (message: string) => void;
}

export async function handleModelsProxyRequest(
  clientRes: ServerResponse,
  ctx: ProxyModelsContext
): Promise<void> {
  let backendModels: unknown[] = [];
  try {
    const payload = await requestJSON({
      host: ctx.backendHost,
      port: ctx.backendPort,
      path: "/v1/models",
      timeoutMs: 5000
    }) as { data?: unknown[] };
    backendModels = Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.onLog?.(`Backend models unavailable: ${message}`);
  }

  sendJSON(clientRes, 200, {
    object: "list",
    data: backendModels.concat(commandCodeOpenAIModels())
  });
}