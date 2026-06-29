import type { IncomingMessage, ServerResponse } from "node:http";
import { isCommandCodeModel } from "../commandcode/models";
import { handleCommandCodeRequest, type CommandCodeRequestContext } from "../commandcode/handle-request";
import { parseJSONBody } from "./body";
import { forwardRequest, readIncomingMessageBody } from "./http";
import { isChatCompletionsPath, isModelsPath } from "./paths";
import { logRequestReasoning, processOpenAIFastMode, rewriteClaudeThinkingBetas, rewriteGeminiResponsesPath } from "./rewrites";
import { handleModelsProxyRequest, type ProxyModelsContext } from "./models-proxy";

export interface ProxyRequestContext extends ProxyModelsContext, CommandCodeRequestContext {
  backendHost: string;
  backendPort: number;
  onDebugLog?: (line: string) => void;
}

export async function handleProxyRequest(
  clientReq: IncomingMessage,
  clientRes: ServerResponse,
  ctx: ProxyRequestContext
): Promise<void> {
  const originalBody = await readIncomingMessageBody(clientReq);
  let body = originalBody;
  let parsedBody = parseJSONBody(originalBody);
  let targetPath = rewriteGeminiResponsesPath(clientReq.url || "/", parsedBody);
  let headers: Record<string, unknown> = { ...clientReq.headers };

  if (clientReq.method === "GET" && isModelsPath(targetPath)) {
    await handleModelsProxyRequest(clientRes, ctx);
    return;
  }

  delete headers.host;
  delete headers["content-length"];

  headers = rewriteClaudeThinkingBetas(headers, parsedBody);

  const fastModeResult = processOpenAIFastMode(targetPath, body, parsedBody);
  if (fastModeResult.changed && fastModeResult.body && fastModeResult.parsedBody) {
    body = Buffer.from(fastModeResult.body, "utf8");
    parsedBody = fastModeResult.parsedBody;
  }

  if (clientReq.method === "POST" && isChatCompletionsPath(targetPath) && parsedBody && isCommandCodeModel(parsedBody.model)) {
    await handleCommandCodeRequest(parsedBody, clientRes, ctx);
    return;
  }

  if (body.length > 0) {
    headers["content-length"] = Buffer.byteLength(body);
  }

  logRequestReasoning(parsedBody, ctx.onDebugLog);

  await forwardRequest({
    host: ctx.backendHost,
    port: ctx.backendPort,
    method: clientReq.method,
    path: targetPath,
    headers,
    body,
    clientRes
  });
}